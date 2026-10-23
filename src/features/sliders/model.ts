import { t, type Static } from "elysia";

export const SliderImage = t.Object({
  url: t.Optional(t.String()),
  desktopImage: t.Optional(t.String()),
  mobileImage: t.Optional(t.String()),
  title: t.Optional(t.String()),
  subtitle: t.Optional(t.String()),
  ctaLabel: t.Optional(t.String()),
  ctaUrl: t.Optional(t.String()),
  altText: t.Optional(t.String()),
  enabled: t.Optional(t.Boolean()),
  order: t.Optional(t.Number()),
  startsAt: t.Optional(t.String()),
  endsAt: t.Optional(t.String()),
});

export const TypeQuery = t.Object({ type: t.Optional(t.String({ maxLength: 50 })) });
export const TypeParam = t.Object({ type: t.String({ maxLength: 50 }) });

export const CreateSlider = t.Object({
  type: t.Optional(t.String({ maxLength: 50 })),
  images: t.Optional(t.Array(SliderImage)),
});
export type CreateSlider = Static<typeof CreateSlider>;

export const UpdateSlider = t.Object({ images: t.Optional(t.Array(SliderImage)) });
export type UpdateSlider = Static<typeof UpdateSlider>;
