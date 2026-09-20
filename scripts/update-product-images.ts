import { db } from "../src/db/client";
import { products } from "../src/db/schema/products";
import { eq } from "drizzle-orm";

async function updateProductImages() {
  try {
    const updates = [
      { slug: "netflix-premium", image: "/images/products/netflix.jpg" },
      { slug: "spotify-premium", image: "/images/products/spotify.jpg" },
      { slug: "chatgpt-plus", image: "/images/products/chatgpt.jpg" },
      { slug: "youtube-premium", image: "/images/products/youtube.jpg" },
      { slug: "discord-nitro", image: "/images/products/discord.jpg" },
      { slug: "canva-pro", image: "/images/products/canva.jpg" },
    ];

    for (const item of updates) {
      await db
        .update(products)
        .set({
          image: item.image,
          banner: item.image,
          slides: [item.image],
        })
        .where(eq(products.slug, item.slug));
      console.log(`✅ Updated ${item.slug} -> ${item.image}`);
    }

    console.log("All product images updated successfully in DB!");
    process.exit(0);
  } catch (err) {
    console.error("Error updating product images:", err);
    process.exit(1);
  }
}

updateProductImages();
