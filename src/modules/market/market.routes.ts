import { Elysia } from "elysia";
import { MarketService } from "./market.service";
import { ok, created } from "../../shared/response";
import { requireAdminPlugin } from "../../middleware/admin.middleware";

export const marketRoutes = new Elysia({ prefix: "/market" })
  .get("/", async ({ query }) => {
    const list = await MarketService.getAccounts(query.category);
    return ok(list);
  })
  .get("/categories", async () => {
    const list = await MarketService.getCategories();
    return ok(list);
  })
  .get("/:id", async ({ params }) => {
    const acc = await MarketService.getAccountById(params.id);
    return ok(acc);
  })
  .use(requireAdminPlugin)
  .get("/admin", async () => {
    const list = await MarketService.getAllAdminAccounts();
    return ok(list);
  })
  .post("/admin", async ({ body }) => {
    const item = await MarketService.upsertAccount(undefined, body);
    return created(item, "Market account created");
  })
  .put("/admin/:id", async ({ params, body }) => {
    const item = await MarketService.upsertAccount(params.id, body);
    return ok(item, "Market account updated");
  })
  .delete("/admin/:id", async ({ params }) => {
    await MarketService.deleteAccount(params.id);
    return ok({ success: true }, "Market account deleted");
  })
  .post("/categories", async ({ body }) => {
    const cat = await MarketService.createCategory((body as any).name, (body as any).description);
    return created(cat, "Category created");
  })
  .put("/categories/:id", async ({ params, body }) => {
    const cat = await MarketService.updateCategory(params.id, (body as any).name, (body as any).description);
    return ok(cat, "Category updated");
  })
  .delete("/categories/:id", async ({ params }) => {
    await MarketService.deleteCategory(params.id);
    return ok({ success: true }, "Category deleted");
  });
