import { t, type Static } from "elysia";

export const CreateCategory = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  slug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  image: t.Optional(t.Union([t.String(), t.Null()])),
  order: t.Optional(t.Number()),
  isActive: t.Optional(t.Boolean()),
});
export type CreateCategory = Static<typeof CreateCategory>;

export const UpdateCategory = t.Partial(CreateCategory);
export type UpdateCategory = Static<typeof UpdateCategory>;
