import { t, type Static } from "elysia";

const NullableString = (max: number) => t.Optional(t.Union([t.String({ maxLength: max }), t.Null()]));
const NullableDate = t.Optional(t.Union([t.String(), t.Null()]));

export const CreateEvent = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  nameKh: NullableString(255),
  image: t.String({ minLength: 1 }),
  eventBanner: t.Optional(t.Union([t.String(), t.Null()])),
  eventPrice: NullableString(50),
  originalPrice: NullableString(50),
  productId: NullableString(255),
  costId: NullableString(255),
  link: NullableString(500),
  order: t.Optional(t.Number()),
  isActive: t.Optional(t.Boolean()),
  startsAt: NullableDate,
  endsAt: NullableDate,
});
export type CreateEvent = Static<typeof CreateEvent>;

export const UpdateEvent = t.Partial(CreateEvent);
export type UpdateEvent = Static<typeof UpdateEvent>;
