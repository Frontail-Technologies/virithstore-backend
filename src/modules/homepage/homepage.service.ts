import { EventsService } from "../events/events.service";
import { ProductsService } from "../products/products.service";
import { SettingsService } from "../settings/settings.service";
import { SlidersService, type PublicHeroSlide } from "../sliders/sliders.service";

async function safely<T>(label: string, fallback: T, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`Homepage ${label} query failed:`, error);
    return fallback;
  }
}

export class HomepageService {
  static async get() {
    const [settings, heroSlides, events, productGroups] = await Promise.all([
      safely<Record<string, any>>("announcement", {}, () => SettingsService.getAll()),
      safely<PublicHeroSlide[]>("hero", [], () => SlidersService.getActiveByType("home")),
      safely("events", [], () => EventsService.getPublicActive()),
      safely("products", { featuredProducts: [], accountProducts: [], digitalServices: [] }, () => ProductsService.getHomepageGroups()),
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
}
