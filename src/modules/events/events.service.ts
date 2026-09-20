import { db } from "../../db/client";
import { events, type NewEvent } from "../../db/schema/events";
import { eq, asc } from "drizzle-orm";
import { NotFoundError } from "../../shared/errors";

export class EventsService {
  static async getAll() {
    return await db.select().from(events).orderBy(asc(events.order));
  }

  static async getActive() {
    return await db.select().from(events).where(eq(events.isActive, true)).orderBy(asc(events.order));
  }

  static async create(data: NewEvent) {
    const [created] = await db.insert(events).values(data).returning();
    return created;
  }

  static async update(id: string, data: Partial<NewEvent>) {
    const [updated] = await db
      .update(events)
      .set({ ...data, updatedAt: new Date() })
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
