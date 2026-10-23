import { t, type Static } from "elysia";

export const ProductType = t.Union([t.Literal("digital-service"), t.Literal("account")]);

const Price = t.Union([t.String({ maxLength: 20 }), t.Number({ minimum: 0 })]);

export const ProductCostItem = t.Object({
  id: t.String({ minLength: 1 }),
  price: Price,
  name: t.Optional(t.String()),
  amount: t.Optional(t.String()),
  costPrice: t.Optional(t.Union([Price, t.Null()])),
  durationDays: t.Optional(t.Number()),
  note: t.Optional(t.String()),
  image: t.Optional(t.String()),
  category: t.Optional(t.String()),
  stock: t.Optional(t.Number()),
  inStock: t.Optional(t.Boolean()),
  isActive: t.Optional(t.Boolean()),
});

export const ProductFieldItem = t.Object({
  label: t.String(),
  name: t.String(),
  type: t.Union([t.Literal("text"), t.Literal("number"), t.Literal("url"), t.Literal("select"), t.Literal("email")]),
  placeholder: t.Optional(t.String()),
  required: t.Optional(t.Boolean()),
  options: t.Optional(t.Array(t.String())),
});

export const CreateProduct = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  nameKh: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  slug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  image: t.String({ minLength: 1 }),
  slides: t.Optional(t.Array(t.String())),
  banner: t.Optional(t.Union([t.String(), t.Null()])),
  type: ProductType,
  region: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  categoryId: t.Optional(t.Union([t.String(), t.Null()])),
  isAvailable: t.Optional(t.Boolean()),
  isFeatured: t.Optional(t.Boolean()),
  isHot: t.Optional(t.Boolean()),
  isPopular: t.Optional(t.Boolean()),
  isAutoDelivery: t.Optional(t.Boolean()),
  stock: t.Optional(t.Boolean()),
  spinActive: t.Optional(t.Boolean()),
  spinCostIds: t.Optional(t.Array(t.String())),
  cost: t.Optional(t.Array(ProductCostItem)),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  guide: t.Optional(t.Union([t.String(), t.Null()])),
  fields: t.Optional(t.Array(ProductFieldItem)),
});
export type CreateProduct = Static<typeof CreateProduct>;

export const UpdateProduct = t.Partial(CreateProduct);
export type UpdateProduct = Static<typeof UpdateProduct>;

export const ProductsQuery = t.Object({
  type: t.Optional(ProductType),
  categoryId: t.Optional(t.String()),
  isHot: t.Optional(t.String()),
  isFeatured: t.Optional(t.String()),
  search: t.Optional(t.String({ maxLength: 100 })),
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});
export type ProductsQuery = Static<typeof ProductsQuery>;

export const SlugParam = t.Object({ slug: t.String({ minLength: 1, maxLength: 255 }) });

export const BulkDeleteProducts = t.Object({ ids: t.Array(t.String(), { minItems: 1, maxItems: 100 }) });
