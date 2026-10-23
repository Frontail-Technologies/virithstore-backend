import { t, type Static } from "elysia";

export const UpdateProfile = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  image: t.Optional(t.String({ maxLength: 2048 })),
  password: t.Optional(t.String({ minLength: 8, maxLength: 128 })),
});
export type UpdateProfile = Static<typeof UpdateProfile>;

export const AdminUpdateUser = t.Object({
  role: t.Optional(t.Union([t.Literal("admin"), t.Literal("user")])),
  isBlocked: t.Optional(t.Boolean()),
  isDeleted: t.Optional(t.Boolean()),
  password: t.Optional(t.String({ minLength: 8, maxLength: 128 })),
});
export type AdminUpdateUser = Static<typeof AdminUpdateUser>;

export const UsersQuery = t.Object({
  search: t.Optional(t.String({ maxLength: 100 })),
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});
export type UsersQuery = Static<typeof UsersQuery>;
