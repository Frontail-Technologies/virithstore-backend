import type { ProductCostItem } from "../../db/schema/products";

export interface HomepageProductDto {
  id: string;
  slug: string;
  name: string;
  nameKh: string | null;
  image: string;
  type: "digital-service" | "account";
  region: string | null;
  isHot: boolean;
  isPopular: boolean;
  inStock: boolean;
  minPrice: string | null;
  originalPrice: string | null;
}

interface HomepageProductRow {
  id: string;
  slug: string;
  name: string;
  nameKh: string | null;
  image: string;
  type: "digital-service" | "account";
  region: string | null;
  isHot: boolean;
  isPopular: boolean;
  stock: boolean;
  cost: ProductCostItem[];
}

/** Storefront card: the cheapest purchasable package decides the displayed price and stock state. */
export function toHomepageProduct(product: HomepageProductRow): HomepageProductDto {
  const purchasable = product.cost.filter((item) => item.isActive !== false && item.inStock !== false && (item.stock ?? 1) > 0);
  const cheapest = purchasable
    .map((item) => ({ item, value: Number(item.price) }))
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => a.value - b.value)[0]?.item;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    nameKh: product.nameKh,
    image: product.image,
    type: product.type,
    region: product.region,
    isHot: product.isHot,
    isPopular: product.isPopular,
    inStock: product.stock && purchasable.length > 0,
    minPrice: cheapest?.price ?? null,
    originalPrice: cheapest?.costPrice ?? null,
  };
}

/** Cost items store prices as strings; the dashboard may send numbers. */
export function normalizeCostItems<T extends { price: string | number; costPrice?: string | number | null }>(
  items: T[],
): (Omit<T, "price" | "costPrice"> & { price: string; costPrice?: string })[] {
  return items.map(({ price, costPrice, ...rest }) => ({
    ...rest,
    price: String(price),
    ...(costPrice !== undefined && costPrice !== null && { costPrice: String(costPrice) }),
  }));
}
