import { Elysia } from "elysia";
import { AccountsVaultService } from "./accounts.service";
import { ok, created } from "../../shared/response";
import { requireAdminPlugin } from "../../middleware/admin.middleware";

export const accountsRoutes = new Elysia({ prefix: "/accounts" })
  .use(requireAdminPlugin)
  .get("/", async ({ query }) => {
    const list = await AccountsVaultService.getAccounts(query.productId as string, query.costId as string);
    return ok(list);
  })
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
