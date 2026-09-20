import { Elysia } from "elysia";
import { CategoriesService } from "./categories.service";
import { ok, created } from "../../shared/response";
import { requireAdmin } from "../../middleware/admin.middleware";

export const categoriesRoutes = new Elysia({ prefix: "/categories" })
  .get("/", async () => {
    const list = await CategoriesService.getAll();
    return ok(list);
  })
  .get("/:id", async ({ params }) => {
    const item = await CategoriesService.getById(params.id);
    return ok(item);
  })
  .use(requireAdmin)
  .post("/", async ({ body }) => {
    const item = await CategoriesService.create(body as any);
    return created(item, "Category created successfully");
  })
  .put("/:id", async ({ params, body }) => {
    const item = await CategoriesService.update(params.id, body as any);
    return ok(item, "Category updated successfully");
  })
  .delete("/:id", async ({ params }) => {
    const deleted = await CategoriesService.delete(params.id);
    return ok(deleted, "Category deleted successfully");
  });
