import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { rateLimiter } from "../../plugins/rate-limit";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { OptionalIdQuery, SaveCoupon, ValidateCoupon } from "./model";
import { createCoupon, deleteCoupon, getCoupon, listCoupons, updateCoupon, validateCoupon } from "./service";

// Coupon codes can be guessed, so validation is rate limited per client.
const couponValidation = new Elysia({ name: "coupon-validation-limit" }).use(rateLimiter(30));

// The `?id=` / body-id variants on `/` exist for the legacy dashboard client and go away with its migration.
export const couponsFeature = new Elysia({ prefix: "/coupons", name: "feature.coupons", tags: ["Coupons"] })
  .use(authPlugin)
  .use(couponValidation)
  .post("/validate", async ({ body }) => ok(await validateCoupon(body.code, body.amount)), { body: ValidateCoupon })
  .get("/", async ({ query }) => ok(query.id ? await getCoupon(query.id) : await listCoupons()), {
    admin: true,
    query: OptionalIdQuery,
  })
  .get("/:id", async ({ params }) => ok(await getCoupon(params.id)), { admin: true, params: IdParam })
  .post("/", async ({ body }) => created(await createCoupon(body), "Coupon created successfully"), {
    admin: true,
    body: SaveCoupon,
  })
  .put("/", async ({ query, body }) => ok(await updateCoupon(query.id ?? body.id ?? body._id, body), "Coupon updated successfully"), {
    admin: true,
    query: OptionalIdQuery,
    body: SaveCoupon,
  })
  .put("/:id", async ({ params, body }) => ok(await updateCoupon(params.id, body), "Coupon updated successfully"), {
    admin: true,
    params: IdParam,
    body: SaveCoupon,
  })
  .delete("/", async ({ query }) => ok(await deleteCoupon(query.id), "Coupon deleted successfully"), {
    admin: true,
    query: OptionalIdQuery,
  })
  .delete("/:id", async ({ params }) => ok(await deleteCoupon(params.id), "Coupon deleted successfully"), {
    admin: true,
    params: IdParam,
  });
