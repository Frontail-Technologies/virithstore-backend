import { db } from "../../db/client";
import { events, type NewEvent } from "../../db/schema/events";
import { products, type ProductCostItem } from "../../db/schema/products";
import { eq, asc, and, or, inArray } from "drizzle-orm";
import { NotFoundError } from "../../shared/errors";

export function isEventActive(
  event: { isActive: boolean; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
) {
  return event.isActive && (!event.startsAt || event.startsAt <= now) && (!event.endsAt || event.endsAt >= now);
}

export class EventsService {
  static async getAll() {
    return await db.select().from(events).orderBy(asc(events.order));
  }

  static async getActive() {
    return await db.select().from(events).where(eq(events.isActive, true)).orderBy(asc(events.order));
  }

  static async getPublicActive(now = new Date()) {
    const activeEvents = (await this.getActive()).filter((event) => isEventActive(event, now));
    const references = activeEvents.map((event) => event.productId).filter((value): value is string => Boolean(value));
    const linkedProducts = references.length === 0 ? [] : await db
      .select({ id: products.id, slug: products.slug, name: products.name, image: products.image, cost: products.cost })
      .from(products)
      .where(and(
        eq(products.isDeleted, false),
        eq(products.isAvailable, true),
        or(inArray(products.id, references), inArray(products.slug, references)),
      ));

    const byReference = new Map<string, typeof linkedProducts[number]>();
    for (const product of linkedProducts) {
      byReference.set(product.id, product);
      byReference.set(product.slug, product);
    }

    return activeEvents.map((event) => {
      const product = event.productId ? byReference.get(event.productId) : undefined;
      const selectedCost = product?.cost.find((cost: ProductCostItem) => cost.id === event.costId);
      return {
        id: event.id,
        name: event.name || product?.name || "Promotion",
        nameKh: event.nameKh,
        image: event.eventBanner || event.image || product?.image || "",
        price: event.eventPrice || (selectedCost?.price ? `$${selectedCost.price}` : null),
        originalPrice: event.originalPrice || (selectedCost?.costPrice ? `$${selectedCost.costPrice}` : null),
        href: event.link || (product ? `/product/${product.slug}` : null),
        order: event.order,
      };
    }).filter((event) => event.image && event.href);
  }

  static async create(data: NewEvent) {
    const { id, _id, ...cleanData } = (data || {}) as any;
    const [created] = await db.insert(events).values(cleanData).returning();
    return created;
  }

  static async update(id: string, data: Partial<NewEvent>) {
    const { id: _, _id, ...cleanData } = (data || {}) as any;
    const [updated] = await db
      .update(events)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();

    if (!updated) throw new NotFoundError("Event not found");
    return updated;
  }

  static async delete(id: string) {
    const [deleted] = await db.delete(events).where(eq(events.id, id)).returning();
    if (!deleted) throw new NotFoundError("Event not found");
    return deleted;
  }
}
