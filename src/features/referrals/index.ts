import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { ok } from "../../libs/response";
import { parseOffset } from "../../libs/pagination";
import { OffsetQuery } from "../../handlers/params";
import { ReferralConfig } from "./model";
import { getReferralConfig, getReferralStats, listReferralConversions, updateReferralConfig } from "./service";

export const referralsFeature = new Elysia({ prefix: "/referrals", name: "feature.referrals", tags: ["Referrals"] })
  .use(authPlugin)
  // Public: guests see the program and signup bonus before registering.
  .get("/config", async () => ok(await getReferralConfig()))
  .get("/my-stats", async ({ user }) => ok(await getReferralStats(user.id)), { auth: true });

export const adminReferralsFeature = new Elysia({
  prefix: "/admin/referrals",
  name: "feature.admin-referrals",
  tags: ["Referrals"],
})
  .use(authPlugin)
  .get("/config", async () => ok(await getReferralConfig()), { admin: true })
  .put(
    "/config",
    async ({ body }) => ok(await updateReferralConfig(body), "Referral program settings updated successfully"),
    { admin: true, body: ReferralConfig },
  )
  .get(
    "/list",
    async ({ query }) => {
      const { limit, offset } = parseOffset(query, { defaultLimit: 100, maxLimit: 200 });
      return ok(await listReferralConversions(limit, offset));
    },
    { admin: true, query: OffsetQuery },
  );
