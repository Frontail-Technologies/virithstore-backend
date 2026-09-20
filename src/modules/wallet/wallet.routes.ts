import { Elysia, t } from "elysia";
import { WalletService } from "./wallet.service";
import { requireAuthPlugin } from "../../middleware/auth.middleware";
import { requireAdminPlugin } from "../../middleware/admin.middleware";
import { ok } from "../../shared/response";

export const walletRoutes = new Elysia({ prefix: "/wallet" })
  // User auth required
  .use(requireAuthPlugin)
  .get("/me", async ({ user }) => {
    const data = await WalletService.getUserWallet(user.id);
    return ok(data);
  })
  .get(
    "/transactions",
    async ({ user, query }) => {
      const limit = Number(query.limit) || 50;
      const offset = Number(query.offset) || 0;
      const data = await WalletService.getUserTransactions(user.id, limit, offset);
      return ok(data);
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  );

export const adminWalletRoutes = new Elysia({ prefix: "/admin/wallet" })
  .use(requireAdminPlugin)
  .post(
    "/adjust",
    async ({ body, adminUser }) => {
      const b = body as {
        userId: string;
        points: number;
        reason: string;
      };
      const result = await WalletService.adjustPoints({
        userId: b.userId,
        points: Number(b.points),
        type: "admin_adjustment",
        description: `Admin adjustment by ${adminUser.name || adminUser.email}: ${b.reason || "Manual update"}`,
        referenceId: `admin_${adminUser.id}`,
      });
      return ok(result, "Wallet points adjusted successfully");
    },
    {
      body: t.Object({
        userId: t.String(),
        points: t.Number(),
        reason: t.String(),
      }),
    }
  );
