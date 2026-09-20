import { Elysia, t } from "elysia";
import { ReferralsService } from "./referrals.service";
import { requireAuthPlugin } from "../../middleware/auth.middleware";
import { requireAdminPlugin } from "../../middleware/admin.middleware";
import { ok } from "../../shared/response";

export const referralsRoutes = new Elysia({ prefix: "/referrals" })
  // Public config for guest visitors & signup bonus info
  .get("/config", async () => {
    const config = await ReferralsService.getConfig();
    return ok(config);
  })

  // User auth required
  .use(requireAuthPlugin)
  .get("/my-stats", async ({ user }) => {
    const data = await ReferralsService.getUserReferralStats(user.id);
    return ok(data);
  });

export const adminReferralsRoutes = new Elysia({ prefix: "/admin/referrals" })
  .use(requireAdminPlugin)
  .get("/config", async () => {
    const config = await ReferralsService.getConfig();
    return ok(config);
  })
  .put(
    "/config",
    async ({ body }) => {
      const updated = await ReferralsService.updateConfig(body as any);
      return ok(updated, "Referral program settings updated successfully");
    },
    {
      body: t.Object({
        isEnabled: t.Boolean(),
        rewardType: t.Union([t.Literal("percentage"), t.Literal("fixed")]),
        commissionValue: t.Number(),
        pointsPerDollar: t.Number(),
        minOrderAmount: t.Number(),
        refereeDiscountPercent: t.Number(),
        terms: t.String(),
      }),
    }
  )
  .get(
    "/list",
    async ({ query }) => {
      const limit = Number(query.limit) || 100;
      const offset = Number(query.offset) || 0;
      const list = await ReferralsService.getAllReferralsAdmin(limit, offset);
      return ok(list);
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  );
