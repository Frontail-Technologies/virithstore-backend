import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { AdminUpdateUser, UpdateProfile, UsersQuery } from "./model";
import { getUser, hardDeleteUser, listUsers, updateProfile, updateUserByAdmin } from "./service";

export const usersFeature = new Elysia({ prefix: "/users", name: "feature.users", tags: ["Users"] })
  .use(authPlugin)
  .put("/profile", async ({ user, body }) => ok(await updateProfile(user.id, body), "Profile updated successfully"), {
    auth: true,
    body: UpdateProfile,
  })
  .get(
    "/admin/all",
    async ({ query }) => {
      const result = await listUsers(query);
      return ok(result.items, "Users fetched", result.meta);
    },
    { admin: true, query: UsersQuery },
  )
  .get("/admin/:id", async ({ params }) => ok(await getUser(params.id)), { admin: true, params: IdParam })
  .put("/admin/:id", async ({ params, body }) => ok(await updateUserByAdmin(params.id, body), "User updated successfully"), {
    admin: true,
    params: IdParam,
    body: AdminUpdateUser,
  })
  .delete("/admin/:id", async ({ params }) => ok(await hardDeleteUser(params.id), "User permanently deleted"), {
    admin: true,
    params: IdParam,
  });
