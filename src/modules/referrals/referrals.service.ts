import { db } from "../../db/client";
import { users } from "../../db/schema/users";
import { referralTransactions } from "../../db/schema/referrals";
import { settings } from "../../db/schema/settings";
import { eq, desc, sql } from "drizzle-orm";
import { AppError } from "../../shared/errors";
import { WalletService } from "../wallet/wallet.service";
import crypto from "crypto";

export interface ReferralConfig {
  isEnabled: boolean;
  rewardType: "percentage" | "fixed";
  commissionValue: number; // e.g. 5% or 100 points
  pointsPerDollar: number; // e.g. 100 points = $1.00 USD
  minOrderAmount: number; // e.g. $1.00
  refereeDiscountPercent: number; // e.g. 5%
  terms: string;
}

const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  isEnabled: true,
  rewardType: "percentage",
  commissionValue: 5,
  pointsPerDollar: 100,
  minOrderAmount: 1.0,
  refereeDiscountPercent: 5,
  terms: "Share your referral link with friends. When they place an order on Virith Store, you will instantly earn Points credited directly to your Virith Points Wallet!",
};

export class ReferralsService {
  /**
   * Get Referral Program Settings
   */
  static async getConfig(): Promise<ReferralConfig> {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "referral_config"))
      .limit(1);

    if (!row || !row.value) {
      return DEFAULT_REFERRAL_CONFIG;
    }
    return { ...DEFAULT_REFERRAL_CONFIG, ...(row.value as any) };
  }

  /**
   * Update Referral Program Settings (Admin)
   */
  static async updateConfig(newConfig: Partial<ReferralConfig>) {
    const current = await this.getConfig();
    const updated = { ...current, ...newConfig };

    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "referral_config"))
      .limit(1);

    if (existing) {
      await db
        .update(settings)
        .set({ value: updated, updatedAt: new Date() })
        .where(eq(settings.key, "referral_config"));
    } else {
      await db.insert(settings).values({
        key: "referral_config",
        value: updated,
      });
    }

    return updated;
  }

  /**
   * Get user's referral code, link, stats & conversions
   */
  static async getUserReferralStats(userId: string) {
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // If user has no referral code yet, generate one
    if (!user.referralCode) {
      const newCode = "VRT-" + crypto.randomBytes(3).toString("hex").toUpperCase();
      await db.update(users).set({ referralCode: newCode }).where(eq(users.id, userId));
      user.referralCode = newCode;
    }

    const config = await this.getConfig();

    // Total friends invited (registered users with referredBy = userId)
    const referees = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.referredBy, userId));

    // Successful referral orders & points
    const history = await db
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
      .limit(50);

    return {
      referralCode: user.referralCode,
      walletPoints: user.walletPoints || 0,
      totalPointsEarned: user.totalReferralPointsEarned || 0,
      totalFriendsInvited: referees.length,
      totalOrdersConverted: history.length,
      config,
      recentConversions: history,
    };
  }

  /**
   * Process and reward referral on order completion
   */
  static async processOrderReferral(order: {
    id: string;
    userId?: string | null;
    price: string | number;
  }) {
    if (!order.userId) return;

    const config = await this.getConfig();
    if (!config.isEnabled) return;

    const orderAmount = Number(order.price) || 0;
    if (orderAmount < (config.minOrderAmount || 1.0)) return;

    // Check if buyer was referred by someone
    const [buyer] = await db
      .select()
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);

    if (!buyer || !buyer.referredBy) return;

    const referrerId = buyer.referredBy;
    if (referrerId === buyer.id) return; // Prevent self-referral

    // Prevent duplicate reward for same order
    const [existingTx] = await db
      .select()
      .from(referralTransactions)
      .where(eq(referralTransactions.orderId, order.id))
      .limit(1);

    if (existingTx) return;

    // Calculate Points
    let pointsToCredit = 0;
    const pointsPerDollar = config.pointsPerDollar || 100;

    if (config.rewardType === "percentage") {
      // e.g. 5% of orderAmount ($20 -> $1.00 -> 100 Points)
      const commissionUsd = (orderAmount * (config.commissionValue || 5)) / 100;
      pointsToCredit = Math.max(1, Math.round(commissionUsd * pointsPerDollar));
    } else {
      // Fixed points per order
      pointsToCredit = Math.round(config.commissionValue || 100);
    }

    if (pointsToCredit <= 0) return;

    // 1. Credit Points to Referrer's Wallet
    await WalletService.adjustPoints({
      userId: referrerId,
      points: pointsToCredit,
      type: "referral_reward",
      orderId: order.id,
      description: `Referral commission from friend's order #${order.id.slice(0, 8)} (+${pointsToCredit} PTS)`,
    });

    // 2. Record referral transaction
    await db.insert(referralTransactions).values({
      referrerId,
      refereeId: buyer.id,
      orderId: order.id,
      orderAmount: String(orderAmount),
      pointsEarned: pointsToCredit,
      status: "completed",
    });

    console.log(`[Referral] Credited ${pointsToCredit} PTS to referrer ${referrerId} for order ${order.id}`);
  }

  /**
   * Admin list of all referral conversions
   */
  static async getAllReferralsAdmin(limit = 100, offset = 0) {
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

    // Fetch user names
    const userIds = new Set<string>();
    list.forEach((r) => {
      userIds.add(r.referrerId);
      userIds.add(r.refereeId);
    });

    const userMap: Record<string, { name: string; email: string }> = {};
    if (userIds.size > 0) {
      const foundUsers = await db.select().from(users);
      foundUsers.forEach((u) => {
        userMap[u.id] = { name: u.name || "User", email: u.email || "" };
      });
    }

    return list.map((r) => ({
      ...r,
      referrer: userMap[r.referrerId] || { name: "Unknown", email: "" },
      referee: userMap[r.refereeId] || { name: "Unknown", email: "" },
    }));
  }
}
