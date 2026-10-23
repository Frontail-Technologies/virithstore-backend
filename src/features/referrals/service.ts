import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { users } from "../../db/schema/users";
import { referralTransactions } from "../../db/schema/referrals";
import { notFound } from "../../libs/http-error";
import { generateReferralCode } from "../../libs/ids";
import { getSetting, setSetting } from "../settings/service";
import { applyPointsAdjustment } from "../wallet/service";
import { DEFAULT_REFERRAL_CONFIG, type ReferralConfig } from "./model";
import { calculateReferralPoints } from "./rewards";

const CONFIG_KEY = "referral_config";

export async function getReferralConfig(): Promise<ReferralConfig> {
  const stored = await getSetting(CONFIG_KEY);
  return stored ? { ...DEFAULT_REFERRAL_CONFIG, ...(stored as Partial<ReferralConfig>) } : DEFAULT_REFERRAL_CONFIG;
}

export async function updateReferralConfig(changes: Partial<ReferralConfig>) {
  const updated = { ...(await getReferralConfig()), ...changes };
  await setSetting(CONFIG_KEY, updated);
  return updated;
}

/** The user's referral code, link stats and recent conversions. */
export async function getReferralStats(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("User not found");

  let referralCode = user.referralCode;
  if (!referralCode) {
    referralCode = generateReferralCode();
    await db.update(users).set({ referralCode }).where(eq(users.id, userId));
  }

  const [config, [{ invited }], history] = await Promise.all([
    getReferralConfig(),
    db.select({ invited: sql<number>`count(*)::int` }).from(users).where(eq(users.referredBy, userId)),
    db
      .select({
        id: referralTransactions.id,
        orderId: referralTransactions.orderId,
        orderAmount: referralTransactions.orderAmount,
        pointsEarned: referralTransactions.pointsEarned,
        status: referralTransactions.status,
        createdAt: referralTransactions.createdAt,
        refereeId: referralTransactions.refereeId,
      })
      .from(referralTransactions)
      .where(eq(referralTransactions.referrerId, userId))
      .orderBy(desc(referralTransactions.createdAt))
      .limit(50),
  ]);

  return {
    referralCode,
    walletPoints: user.walletPoints,
    totalPointsEarned: user.totalReferralPointsEarned,
    totalFriendsInvited: invited,
    totalOrdersConverted: history.length,
    config,
    recentConversions: history,
  };
}

interface ReferralOrder {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  price: string | number;
}

/**
 * Rewards the buyer's referrer for a completed order. Idempotent per order: the unique order id on
 * `referral_transactions` is claimed first, and the wallet credit shares its transaction.
 */
export async function processOrderReferral(order: ReferralOrder) {
  const config = await getReferralConfig();
  const orderAmount = Number(order.price) || 0;
  const points = calculateReferralPoints(config, orderAmount);
  if (points <= 0) return;

  const buyerCondition = order.userId
    ? eq(users.id, order.userId)
    : order.userEmail
      ? eq(users.email, order.userEmail.toLowerCase())
      : null;
  if (!buyerCondition) return;

  const [buyer] = await db.select({ id: users.id, referredBy: users.referredBy }).from(users).where(buyerCondition).limit(1);
  if (!buyer?.referredBy || buyer.referredBy === buyer.id) return; // no referrer, or self-referral

  const referrerId = buyer.referredBy;
  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(referralTransactions)
      .values({
        referrerId,
        refereeId: buyer.id,
        orderId: order.id,
        orderAmount: String(orderAmount),
        pointsEarned: points,
        status: "completed",
      })
      .onConflictDoNothing()
      .returning({ id: referralTransactions.id });
    if (!claimed) return; // already rewarded for this order

    await applyPointsAdjustment(tx, {
      userId: referrerId,
      points,
      type: "referral_reward",
      orderId: order.id,
      description: `Referral commission from friend's order #${order.id.slice(0, 8)} (+${points} PTS)`,
    });
  });
}

/** Admin list of referral conversions with the names of both parties. */
export async function listReferralConversions(limit: number, offset: number) {
  const list = await db
    .select({
      id: referralTransactions.id,
      orderId: referralTransactions.orderId,
      orderAmount: referralTransactions.orderAmount,
      pointsEarned: referralTransactions.pointsEarned,
      status: referralTransactions.status,
      createdAt: referralTransactions.createdAt,
      referrerId: referralTransactions.referrerId,
      refereeId: referralTransactions.refereeId,
    })
    .from(referralTransactions)
    .orderBy(desc(referralTransactions.createdAt))
    .limit(limit)
    .offset(offset);

  const userIds = [...new Set(list.flatMap((row) => [row.referrerId, row.refereeId]))];
  const people =
    userIds.length === 0
      ? []
      : await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds));
  const byId = new Map(people.map((person) => [person.id, { name: person.name || "User", email: person.email || "" }]));
  const unknown = { name: "Unknown", email: "" };

  return list.map((row) => ({
    ...row,
    referrer: byId.get(row.referrerId) ?? unknown,
    referee: byId.get(row.refereeId) ?? unknown,
  }));
}
