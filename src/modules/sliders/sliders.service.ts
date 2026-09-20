import { db } from "../../db/client";
import { sliders, type SliderImage } from "../../db/schema/sliders";
import { eq, asc } from "drizzle-orm";
import { NotFoundError } from "../../shared/errors";
import { resolveImages } from "../../shared/cloudinary";

export class SlidersService {
  static async getAll() {
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

  static async create(images: SliderImage[] = []) {
    const resolved = await resolveImages(images, "virithstore/sliders");
    const existing = await this.getAll();
    if (existing.length > 0) {
      return this.updateImages(existing[0].id, resolved);
    }
    const [created] = await db
      .insert(sliders)
      .values({ images: resolved })
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
