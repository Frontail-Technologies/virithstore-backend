import { Elysia } from "elysia";
import { GiftsService } from "./gifts.service";
import { ok, created } from "../../shared/response";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";

export const giftsRoutes = new Elysia({ prefix: "/gifts" })
  .get("/", async () => {
    const list = await GiftsService.getAll();
    return ok(list);
  })
  .get("/:id", async ({ params }) => {
    const item = await GiftsService.getById(params.id);
    return ok(item);
  })
  .use(requireAuth)
  .get("/wagering", async ({ user }) => {
    const status = await GiftsService.getUserWagering(user.id);
    return ok(status);
  })
  .post("/claim/:id", async ({ params, user }) => {
    const result = await GiftsService.claimGift(params.id, user.id);
    return ok(result, "Gift claimed successfully");
  })
  .use(requireAdmin)
  .post("/", async ({ body }) => {
    const item = await GiftsService.create(body as any);
    return created(item, "Gift created successfully");
  })
  .put("/:id", async ({ params, body }) => {
    const item = await GiftsService.update(params.id, body as any);
    return ok(item, "Gift updated successfully");
  })
  .delete("/:id", async ({ params }) => {
    const deleted = await GiftsService.delete(params.id);
    return ok(deleted, "Gift deleted successfully");
  });

export const giftTransactionsRoutes = new Elysia({ prefix: "/gift-transactions" })
  .use(requireAdmin)
  .get("/admin", async () => {
    const list = await GiftsService.getAllTransactions();
    return ok(list);
  })
  .put("/admin/:id/status", async ({ params, body }) => {
    const updated = await GiftsService.updateTransactionStatus(params.id, (body as any).status);
    return ok(updated, "Status updated");
  });

