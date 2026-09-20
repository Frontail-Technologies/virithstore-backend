import { Elysia } from "elysia";
import { SpinService } from "./spin.service";
import { ok, created } from "../../shared/response";
import { requireAuthPlugin } from "../../middleware/auth.middleware";
import { requireAdminPlugin } from "../../middleware/admin.middleware";

export const spinRoutes = new Elysia({ prefix: "/spin" })
  .get("/prizes", async () => {
    const list = await SpinService.getPrizes();
    return ok(list);
  })
  .use(requireAuthPlugin)
  .post("/play", async ({ user }) => {
    const result = await SpinService.spin(user.id);
    return ok(result, "Spin completed!");
  })
  .get("/my-credits", async ({ user }) => {
    const count = await SpinService.getAvailableCredits(user.id);
    return ok({ credits: count });
  })
  .get("/my-history", async ({ user }) => {
    const list = await SpinService.getUserHistory(user.id);
    return ok(list);
  })
  .use(requireAdminPlugin)
  .get("/admin/prizes", async () => {
    const list = await SpinService.getAllPrizes();
    return ok(list);
  })
  .get("/admin/history", async () => {
    const list = await SpinService.getAllHistory();
    return ok(list);
  })
  .post("/admin/prizes", async ({ body }) => {
    const item = await SpinService.createPrize(body as any);
    return created(item, "Prize created successfully");
  })
  .put("/admin/prizes/:id", async ({ params, body }) => {
    const item = await SpinService.updatePrize(params.id, body as any);
    return ok(item, "Prize updated successfully");
  })
  .delete("/admin/prizes/:id", async ({ params }) => {
    const deleted = await SpinService.deletePrize(params.id);
    return ok(deleted, "Prize deleted successfully");
  })
  .put("/update-status", async ({ body }) => {
    const b = body as any;
    const updated = await SpinService.updateTransactionStatus(b.id, b.status);
    return ok(updated, "Status updated successfully");
  });
