import { Elysia, t } from "elysia";
import { ProductsService } from "./products.service";
import { ok, created } from "../../shared/response";
import { requireAdmin } from "../../middleware/admin.middleware";

export const productsRoutes = new Elysia({ prefix: "/products" })
  // Public routes
  .get("/", async ({ query }) => {
    const result = await ProductsService.getAll({
      type: query.type as any,
      categoryId: query.categoryId,
      isHot: query.isHot === "true" ? true : query.isHot === "false" ? false : undefined,
      isFeatured: query.isFeatured === "true" ? true : query.isFeatured === "false" ? false : undefined,
      search: query.search,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    });
    return ok(result.items, "Products fetched", result.meta);
  })
  .get("/slug/:slug", async ({ params }) => {
    const product = await ProductsService.getBySlug(params.slug);
    return ok(product);
  })
  .get("/:id", async ({ params }) => {
    const product = await ProductsService.getById(params.id);
    return ok(product);
  })

  // Admin routes
  .use(requireAdmin)
  .post(
    "/",
    async ({ body }) => {
      const product = await ProductsService.create(body as any);
      return created(product, "Product created successfully");
    }
  )
  .put("/:id", async ({ params, body }) => {
    const product = await ProductsService.update(params.id, body as any);
    return ok(product, "Product updated successfully");
  })
  .delete("/:id", async ({ params }) => {
    const deleted = await ProductsService.delete(params.id);
    return ok(deleted, "Product deleted successfully");
  })
  .post(
    "/bulk-delete",
    async ({ body }) => {
      const result = await ProductsService.bulkDelete((body as any).ids);
      return ok(result, "Bulk delete completed");
    },
    { body: t.Object({ ids: t.Array(t.String()) }) }
  );
