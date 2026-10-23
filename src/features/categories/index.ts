import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { CreateCategory, UpdateCategory } from "./model";
import { createCategory, deleteCategory, getCategory, listCategories, updateCategory } from "./service";

export const categoriesFeature = new Elysia({ prefix: "/categories", name: "feature.categories", tags: ["Categories"] })
  .use(authPlugin)
  .get("/", async () => ok(await listCategories()))
  .get("/:id", async ({ params }) => ok(await getCategory(params.id)), { params: IdParam })
  .post("/", async ({ body }) => created(await createCategory(body), "Category created successfully"), {
    admin: true,
    body: CreateCategory,
  })
  .put("/:id", async ({ params, body }) => ok(await updateCategory(params.id, body), "Category updated successfully"), {
    admin: true,
    params: IdParam,
    body: UpdateCategory,
  })
  .delete("/:id", async ({ params }) => ok(await deleteCategory(params.id), "Category deleted successfully"), {
    admin: true,
    params: IdParam,
  });
