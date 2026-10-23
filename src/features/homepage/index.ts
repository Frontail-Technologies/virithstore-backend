import { Elysia } from "elysia";
import { ok } from "../../libs/response";
import { listPublicEvents } from "../events/service";
import { listHomepageProductGroups } from "../products/service";
import { getAllSettings } from "../settings/service";
import { getActiveSlidesByType } from "../sliders/service";

/** One section failing (e.g. a slow query) degrades to its fallback instead of breaking the whole page. */
async function safely<T>(label: string, fallback: T, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`Homepage ${label} query failed:`, error);
    return fallback;
  }
}

export async function getHomepage() {
  const [settings, heroSlides, events, productGroups] = await Promise.all([
    safely<Record<string, unknown>>("announcement", {}, getAllSettings),
    safely("hero", [], () => getActiveSlidesByType("home")),
    safely("events", [], () => listPublicEvents()),
    safely("products", { featuredProducts: [], accountProducts: [], digitalServices: [] }, () => listHomepageProductGroups()),
  ]);
  const announcementText = typeof settings.announcementText === "string" ? settings.announcementText.trim() : "";

  return {
    announcement: {
      enabled: settings.isAnnouncementActive !== false && Boolean(announcementText),
      text: announcementText,
    },
    heroSlides,
    events,
    ...productGroups,
  };
}

export const homepageFeature = new Elysia({ prefix: "/homepage", name: "feature.homepage", tags: ["Homepage"] }).get(
  "/",
  async ({ set }) => {
    set.headers["cache-control"] = "public, max-age=30, stale-while-revalidate=120";
    return ok(await getHomepage());
  },
);
