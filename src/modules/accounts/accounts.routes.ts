import { Elysia } from "elysia";
import { AccountsVaultService } from "./accounts.service";
import { ok, created } from "../../shared/response";
import { requireAdminPlugin } from "../../middleware/admin.middleware";

export const accountsRoutes = new Elysia({ prefix: "/accounts" })
  .use(requireAdminPlugin)
  .get("/", async ({ query }) => {
    const result = await AccountsVaultService.getAccounts({
      productId: query.productId as string,
      costId: query.costId as string,
      status: query.status as string,
      search: query.search as string,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 25,
    });
    return ok(result.items, "Accounts fetched", result.meta);
  })
  .get("/:id", async ({ params }) => ok(await AccountsVaultService.getAccountById(params.id)))
  .post("/", async ({ body }) => {
    const item = await AccountsVaultService.upsertAccount(undefined, body);
    return created(item, "Account credentials added");
  })
  .put("/:id", async ({ params, body }) => {
    const item = await AccountsVaultService.upsertAccount(params.id, body);
    return ok(item, "Account credentials updated");
  })
  .delete("/:id", async ({ params }) => {
    await AccountsVaultService.deleteAccount(params.id);
    return ok({ success: true }, "Account credentials deleted");
  });
