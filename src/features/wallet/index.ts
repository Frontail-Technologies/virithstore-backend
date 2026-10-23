import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { ok } from "../../libs/response";
import { parseOffset } from "../../libs/pagination";
import { OffsetQuery } from "../../handlers/params";
import { AdminAdjustWallet } from "./model";
import { adjustPoints, getWalletSummary, listWalletTransactions } from "./service";

export const walletFeature = new Elysia({ prefix: "/wallet", name: "feature.wallet", tags: ["Wallet"] })
  .use(authPlugin)
  .get("/me", async ({ user }) => ok(await getWalletSummary(user.id)), { auth: true })
  .get(
    "/transactions",
    async ({ user, query }) => {
      const { limit, offset } = parseOffset(query);
      return ok(await listWalletTransactions(user.id, limit, offset));
    },
    { auth: true, query: OffsetQuery },
  );

export const adminWalletFeature = new Elysia({ prefix: "/admin/wallet", name: "feature.admin-wallet", tags: ["Wallet"] })
  .use(authPlugin)
  .post(
    "/adjust",
    async ({ body, user: admin }) => {
      const result = await adjustPoints({
        userId: body.userId,
        points: body.points,
        type: "admin_adjustment",
        description: `Admin adjustment by ${admin.name || admin.email}: ${body.reason || "Manual update"}`,
        referenceId: `admin_${admin.id}`,
      });
      return ok(result, "Wallet points adjusted successfully");
    },
    { admin: true, body: AdminAdjustWallet },
  );
