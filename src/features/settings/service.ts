import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { settings } from "../../db/schema/settings";
import { badRequest } from "../../libs/http-error";

/** Keys the storefront may read without authentication. Everything else is admin-only. */
const PUBLIC_SETTING_KEYS = new Set(["announcementText", "isAnnouncementActive", "isMaintenance", "maintenanceMessage"]);

export async function getAllSettings() {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value])) as Record<string, unknown>;
}

export async function getPublicSettings() {
  const all = await getAllSettings();
  return Object.fromEntries(Object.entries(all).filter(([key]) => PUBLIC_SETTING_KEYS.has(key)));
}

export async function getSetting(key: string) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? null;
}

export const getPublicSetting = (key: string) => (PUBLIC_SETTING_KEYS.has(key) ? getSetting(key) : Promise.resolve(null));

export async function setSetting(key: string, value: unknown) {
  const [row] = await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
    .returning();
  return row;
}

export function setSettings(values: unknown) {
  // The route schema has no declared properties, so Elysia does not reject arrays or strings itself.
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    throw badRequest("Settings must be an object of key/value pairs");
  }
  return Promise.all(Object.entries(values).map(([key, value]) => setSetting(key, value)));
}
