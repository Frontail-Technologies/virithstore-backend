import type { Event } from "../../db/schema/events";
import type { ProductCostItem } from "../../db/schema/products";

export function isEventActive(
  event: { isActive: boolean; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
) {
  return event.isActive && (!event.startsAt || event.startsAt <= now) && (!event.endsAt || event.endsAt >= now);
}

interface LinkedProduct {
  slug: string;
  name: string;
  image: string | null;
  cost: ProductCostItem[];
}

/** Storefront card for an event, falling back to the linked product's data. Null when it can't render. */
export function toPublicEvent(event: Event, product?: LinkedProduct) {
  const selectedCost = product?.cost.find((cost) => cost.id === event.costId);
  const card = {
    id: event.id,
    name: event.name || product?.name || "Promotion",
    nameKh: event.nameKh,
    image: event.eventBanner || event.image || product?.image || "",
    price: event.eventPrice || (selectedCost?.price ? `$${selectedCost.price}` : null),
    originalPrice: event.originalPrice || (selectedCost?.costPrice ? `$${selectedCost.costPrice}` : null),
    href: event.link || (product ? `/product/${product.slug}` : null),
    order: event.order,
  };
  return card.image && card.href ? card : null;
}
