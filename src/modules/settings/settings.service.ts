import { db } from "../../db/client";
import { settings, type NewSetting } from "../../db/schema/settings";
import { eq } from "drizzle-orm";

export class SettingsService {
  static async getByKey(key: string) {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    return setting?.value || null;
  }

  static async getAll() {
    const list = await db.select().from(settings);
    const map: Record<string, any> = {};
    for (const item of list) {
      map[item.key] = item.value;
    }
    return map;
  }

  static async setKey(key: string, value: any) {
    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(settings)
        .values({ key, value })
        .returning();
      return created;
    }
  }
}
