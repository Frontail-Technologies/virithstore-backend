import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { MarketQuery, SaveMarketAccount, SaveMarketCategory, UpdateMarketAccount } from "./model";
import {
  createMarketAccount,
  createMarketCategory,
  deleteMarketAccount,
  deleteMarketCategory,
  getPublicAccount,
  listAdminAccounts,
  listMarketCategories,
  listPublicAccounts,
  updateMarketAccount,
  updateMarketCategory,
} from "./service";

export const marketFeature = new Elysia({ prefix: "/market", name: "feature.market", tags: ["Market"] })
  .use(authPlugin)
  .get("/", async ({ query }) => ok(await listPublicAccounts(query.category)), { query: MarketQuery })
  .get("/categories", async () => ok(await listMarketCategories()))
  .get("/admin", async () => ok(await listAdminAccounts()), { admin: true })
  .get("/:id", async ({ params }) => ok(await getPublicAccount(params.id)), { params: IdParam })
  .post("/admin", async ({ body }) => created(await createMarketAccount(body), "Market account created"), {
    admin: true,
    body: SaveMarketAccount,
  })
  .put("/admin/:id", async ({ params, body }) => ok(await updateMarketAccount(params.id, body), "Market account updated"), {
    admin: true,
    params: IdParam,
    body: UpdateMarketAccount,
  })
  .delete("/admin/:id", async ({ params }) => ok(await deleteMarketAccount(params.id), "Market account deleted"), {
    admin: true,
    params: IdParam,
  })
  .post("/categories", async ({ body }) => created(await createMarketCategory(body), "Category created"), {
    admin: true,
    body: SaveMarketCategory,
  })
  .put("/categories/:id", async ({ params, body }) => ok(await updateMarketCategory(params.id, body), "Category updated"), {
    admin: true,
    params: IdParam,
    body: SaveMarketCategory,
  })
  .delete("/categories/:id", async ({ params }) => ok(await deleteMarketCategory(params.id), "Category deleted"), {
    admin: true,
    params: IdParam,
  });
