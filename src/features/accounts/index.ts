import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { AccountsQuery, SaveAccount } from "./model";
import { createAccount, deleteAccount, getAccount, listAccounts, updateAccount } from "./service";

export const accountsFeature = new Elysia({ prefix: "/accounts", name: "feature.accounts", tags: ["Accounts"] })
  .use(authPlugin)
  .get(
    "/",
    async ({ query }) => {
      const result = await listAccounts(query);
      return ok(result.items, "Accounts fetched", result.meta);
    },
    { admin: true, query: AccountsQuery },
  )
  .get("/:id", async ({ params }) => ok(await getAccount(params.id)), { admin: true, params: IdParam })
  .post("/", async ({ body }) => created(await createAccount(body), "Account credentials added"), {
    admin: true,
    body: SaveAccount,
  })
  .put("/:id", async ({ params, body }) => ok(await updateAccount(params.id, body), "Account credentials updated"), {
    admin: true,
    params: IdParam,
    body: SaveAccount,
  })
  .delete("/:id", async ({ params }) => ok(await deleteAccount(params.id), "Account credentials deleted"), {
    admin: true,
    params: IdParam,
  });
