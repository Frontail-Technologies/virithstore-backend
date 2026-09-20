import { Elysia, t } from "elysia";
import { CouponsService } from "./coupons.service";
import { ok, created } from "../../shared/response";
import { requireAdmin } from "../../middleware/admin.middleware";

export const couponsRoutes = new Elysia({ prefix: "/coupons" })
  .post(
    "/validate",
    async ({ body }) => {
      const b = body as any;
      const result = await CouponsService.validate(b.code, b.amount);
      return ok(result);
    },
    {
      body: t.Object({
        code: t.String(),
        amount: t.Number(),
      }),
    }
  )
  .use(requireAdmin)
  .get("/", async ({ query }) => {
    if (query?.id) {
      const item = await CouponsService.getById(query.id as string);
      return ok(item);
    }
    const list = await CouponsService.getAll();
    return ok(list);
  })
  .get("/:id", async ({ params }) => {
    const item = await CouponsService.getById(params.id);
    return ok(item);
  })
  .post("/", async ({ body }) => {
    const item = await CouponsService.create(body as any);
    return created(item, "Coupon created successfully");
  })
  .put("/", async ({ query, body }) => {
    const id = (query?.id as string) || (body as any)?.id || (body as any)?._id;
    const item = await CouponsService.update(id, body as any);
    return ok(item, "Coupon updated successfully");
  })
  .put("/:id", async ({ params, body }) => {
    const item = await CouponsService.update(params.id, body as any);
    return ok(item, "Coupon updated successfully");
  })
  .delete("/", async ({ query, body }) => {
    const id = (query?.id as string) || (body as any)?.id || (body as any)?._id;
    const deleted = await CouponsService.delete(id);
    return ok(deleted, "Coupon deleted successfully");
  })
  .delete("/:id", async ({ params }) => {
    const deleted = await CouponsService.delete(params.id);
    return ok(deleted, "Coupon deleted successfully");
  });
