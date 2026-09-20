import { Elysia, t } from "elysia";
import { UsersService } from "./users.service";
import { ok } from "../../shared/response";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";

export const usersRoutes = new Elysia({ prefix: "/users" })
  .use(requireAuth)
  .put("/profile", async ({ user, body }) => {
    const updated = await UsersService.updateProfile(user.id, body as { name?: string; image?: string; password?: string });
    return ok(updated, "Profile updated successfully");
  })
  .use(requireAdmin)
  .get("/admin/all", async ({ query }) => {
    const result = await UsersService.getAll({
      search: query.search,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    });
    return ok(result.items, "Users fetched", result.meta);
  })
  .get("/admin/:id", async ({ params }) => {
    const user = await UsersService.getById(params.id);
    return ok(user);
  })
  .put("/admin/:id", async ({ params, body }) => {
    const updated = await UsersService.updateUserByAdmin(params.id, body as any);
    return ok(updated, "User updated successfully");
  })
  .delete("/admin/:id", async ({ params }) => {
    const deleted = await UsersService.softDelete(params.id);
    return ok(deleted, "User deleted successfully");
  });
