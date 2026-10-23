import { t } from "elysia";

/** Shared route parameter and query schemas. */
export const IdParam = t.Object({ id: t.String({ minLength: 1, maxLength: 100 }) });

export const PageQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});

export const OffsetQuery = t.Object({
  limit: t.Optional(t.String()),
  offset: t.Optional(t.String()),
});
