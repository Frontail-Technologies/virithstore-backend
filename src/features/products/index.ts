import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { BulkDeleteProducts, CreateProduct, ProductsQuery, SlugParam, UpdateProduct } from "./model";
import {
  bulkDeleteProducts,
  createProduct,
  deleteProduct,
  getProduct,
  getProductBySlug,
  listProductOptions,
  listProducts,
  updateProduct,
} from "./service";

export const productsFeature = new Elysia({ prefix: "/products", name: "feature.products", tags: ["Products"] })
  .use(authPlugin)
  .get(
    "/",
    async ({ query }) => {
      const result = await listProducts(query);
      return ok(result.items, "Products fetched", result.meta);
    },
    { query: ProductsQuery },
  )
  .get("/admin/options", async () => ok(await listProductOptions()), { admin: true })
  .get("/slug/:slug", async ({ params }) => ok(await getProductBySlug(params.slug)), { params: SlugParam })
  .get("/:id", async ({ params }) => ok(await getProduct(params.id)), { params: IdParam })
  .post("/", async ({ body }) => created(await createProduct(body), "Product created successfully"), {
    admin: true,
    body: CreateProduct,
  })
  .post("/bulk-delete", async ({ body }) => ok(await bulkDeleteProducts(body.ids), "Bulk delete completed"), {
    admin: true,
    body: BulkDeleteProducts,
  })
  .put("/:id", async ({ params, body }) => ok(await updateProduct(params.id, body), "Product updated successfully"), {
    admin: true,
    params: IdParam,
    body: UpdateProduct,
  })
  .delete("/:id", async ({ params }) => ok(await deleteProduct(params.id), "Product deleted successfully"), {
    admin: true,
    params: IdParam,
  });
