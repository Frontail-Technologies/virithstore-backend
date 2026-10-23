import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "../../db/client";
import { events } from "../../db/schema/events";
import { products } from "../../db/schema/products";
import { createCrudService } from "../../handlers/crud";
import { isEventActive, toPublicEvent } from "./mappers";
import type { CreateEvent, UpdateEvent } from "./model";

const crud = createCrudService(events, { label: "Event", orderBy: asc(events.order) });

export const listEvents = crud.list;
export const deleteEvent = crud.remove;

export const listActiveEvents = () =>
  db.select().from(events).where(eq(events.isActive, true)).orderBy(asc(events.order));

/** Dates arrive as ISO strings over JSON; the timestamp columns need Date objects. */
const toDates = <T extends { startsAt?: string | null; endsAt?: string | null }>(input: T) => ({
  ...input,
  ...(input.startsAt !== undefined && { startsAt: input.startsAt ? new Date(input.startsAt) : null }),
  ...(input.endsAt !== undefined && { endsAt: input.endsAt ? new Date(input.endsAt) : null }),
});

export const createEvent = (input: CreateEvent) => crud.create(toDates(input));
export const updateEvent = (id: string, input: UpdateEvent) => crud.update(id, toDates(input));

/** Active events within their date window, joined with the products they promote. */
export async function listPublicEvents(now = new Date()) {
  const activeEvents = (await listActiveEvents()).filter((event) => isEventActive(event, now));
  const references = activeEvents.map((event) => event.productId).filter((value): value is string => Boolean(value));
  const linkedProducts =
    references.length === 0
      ? []
      : await db
          .select({ id: products.id, slug: products.slug, name: products.name, image: products.image, cost: products.cost })
          .from(products)
          .where(
            and(
              eq(products.isDeleted, false),
              eq(products.isAvailable, true),
              or(inArray(products.id, references), inArray(products.slug, references)),
            ),
          );

  const byReference = new Map<string, (typeof linkedProducts)[number]>();
  for (const product of linkedProducts) {
    byReference.set(product.id, product);
    byReference.set(product.slug, product);
  }

  return activeEvents
    .map((event) => toPublicEvent(event, event.productId ? byReference.get(event.productId) : undefined))
    .filter((card): card is NonNullable<typeof card> => card !== null);
}
