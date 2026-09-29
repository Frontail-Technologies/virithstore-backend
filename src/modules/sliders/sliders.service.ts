import { db } from "../../db/client";
import { sliders, type SliderImage } from "../../db/schema/sliders";
import { eq, asc } from "drizzle-orm";
import { NotFoundError } from "../../shared/errors";
import { resolveImages } from "../../shared/cloudinary";

export interface PublicHeroSlide {
  desktopImage: string;
  mobileImage?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  altText: string;
  order: number;
}

export function getActiveHeroSlides(
  images: SliderImage[] = [],
  now = new Date(),
): PublicHeroSlide[] {
  return images
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => {
      const desktopImage = image.desktopImage || image.url;
      if (!desktopImage || image.enabled === false) return false;

      const startsAt = image.startsAt ? new Date(image.startsAt) : null;
      const endsAt = image.endsAt ? new Date(image.endsAt) : null;
      if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt > now) return false;
      if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < now) return false;
      return true;
    })
    .sort((a, b) => (a.image.order ?? a.index) - (b.image.order ?? b.index))
    .map(({ image, index }) => ({
      desktopImage: image.desktopImage || image.url!,
      ...(image.mobileImage ? { mobileImage: image.mobileImage } : {}),
      ...(image.title ? { title: image.title } : {}),
      ...(image.subtitle ? { subtitle: image.subtitle } : {}),
      ...(image.ctaLabel ? { ctaLabel: image.ctaLabel } : {}),
      ...(image.ctaUrl ? { ctaUrl: image.ctaUrl } : {}),
      altText: image.altText || image.title || "Virith Store promotion",
      order: image.order ?? index,
    }));
}

export class SlidersService {
  static async getAll(type?: string) {
    if (type) {
      return await db
        .select()
        .from(sliders)
        .where(eq(sliders.type, type))
        .orderBy(asc(sliders.createdAt), asc(sliders.id));
    }
    return await db
      .select()
      .from(sliders)
      .orderBy(asc(sliders.createdAt), asc(sliders.id));
  }

  static async getById(id: string) {
    const [item] = await db.select().from(sliders).where(eq(sliders.id, id));
    if (!item) throw new NotFoundError("Slider not found");
    return item;
  }

  static async getByType(type: string) {
    const [item] = await db
      .select()
      .from(sliders)
      .where(eq(sliders.type, type))
      .limit(1);
    return item || null;
  }

  static async getActiveByType(type: string, now = new Date()) {
    const item = await this.getByType(type);
    return item ? getActiveHeroSlides(item.images, now) : [];
  }

  static async create(images: SliderImage[] = [], type: string = "home") {
    const resolved = await resolveImages(images, "virithstore/sliders");
    const existing = await this.getByType(type);
    if (existing) {
      return this.updateImages(existing.id, resolved);
    }
    const [created] = await db
      .insert(sliders)
      .values({ type, images: resolved })
      .returning();
    return created;
  }

  static async updateImages(id: string, images: SliderImage[]) {
    const resolved = await resolveImages(images, "virithstore/sliders");
    const [updated] = await db
      .update(sliders)
      .set({ images: resolved, updatedAt: new Date() })
      .where(eq(sliders.id, id))
      .returning();

    if (!updated) throw new NotFoundError("Slider not found");
    return updated;
  }

  static async delete(id: string) {
    const [deleted] = await db
      .delete(sliders)
      .where(eq(sliders.id, id))
      .returning();
    if (!deleted) throw new NotFoundError("Slider not found");
    return deleted;
  }
}
