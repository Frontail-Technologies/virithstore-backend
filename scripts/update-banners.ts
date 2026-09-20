import { db } from "../src/db/client";
import { sliders } from "../src/db/schema/sliders";

async function updateBanners() {
  try {
    const bannerImages = [
      { url: "/images/banners/banner-1.jpg" },
      { url: "/images/banners/banner-2.jpg" },
      { url: "/images/banners/banner-3.jpg" },
    ];

    const existing = await db.select().from(sliders).limit(1);
    if (existing.length > 0) {
      await db.update(sliders).set({ images: bannerImages });
      console.log("✅ Updated existing hero slider with 3 new red/black banners");
    } else {
      await db.insert(sliders).values({ images: bannerImages });
      console.log("✅ Inserted 3 new red/black banners into sliders table");
    }
    process.exit(0);
  } catch (err) {
    console.error("Error updating banners:", err);
    process.exit(1);
  }
}

updateBanners();
