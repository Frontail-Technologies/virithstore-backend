import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { sliders, type SliderImage } from "../../db/schema/sliders";
import { notFound } from "../../libs/http-error";
import { resolveImages } from "../../libs/cloudinary";
import { getActiveHeroSlides } from "./mappers";

const IMAGE_FOLDER = "virithstore/sliders";

export async function listSliders(type?: string) {
  const query = db.select().from(sliders);
  return await (type ? query.where(eq(sliders.type, type)) : query).orderBy(asc(sliders.createdAt), asc(sliders.id));
}

export async function getSliderByType(type: string) {
  const [item] = await db.select().from(sliders).where(eq(sliders.type, type)).limit(1);
  return item ?? null;
}

export async function getActiveSlidesByType(type: string, now = new Date()) {
  const item = await getSliderByType(type);
  return item ? getActiveHeroSlides(item.images, now) : [];
}

export async function updateSliderImages(id: string, images: SliderImage[]) {
  const resolved = await resolveImages(images, IMAGE_FOLDER);
  const [updated] = await db
    .update(sliders)
    .set({ images: resolved, updatedAt: new Date() })
    .where(eq(sliders.id, id))
    .returning();
  if (!updated) throw notFound("Slider not found");
  return updated;
}

/** One slider per type: creating for an existing type replaces its images. */
export async function createSlider(images: SliderImage[] = [], type = "home") {
  const existing = await getSliderByType(type);
  if (existing) return updateSliderImages(existing.id, images);

  const resolved = await resolveImages(images, IMAGE_FOLDER);
  const [created] = await db.insert(sliders).values({ type, images: resolved }).returning();
  return created;
}

export async function deleteSlider(id: string) {
  const [deleted] = await db.delete(sliders).where(eq(sliders.id, id)).returning();
  if (!deleted) throw notFound("Slider not found");
  return deleted;
}
