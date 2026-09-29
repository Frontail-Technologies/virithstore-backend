import { describe, expect, test } from "bun:test";
import { getActiveHeroSlides } from "../sliders/sliders.service";
import { isEventActive } from "../events/events.service";
import { toHomepageProduct } from "../products/products.service";

describe("homepage public contract", () => {
  test("filters scheduled hero slides and preserves explicit order", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    const slides = getActiveHeroSlides([
      { url: "/legacy.jpg", order: 2 },
      { desktopImage: "/disabled.jpg", enabled: false, order: 0 },
      { desktopImage: "/future.jpg", startsAt: "2026-09-29T00:00:00Z", order: 1 },
      { desktopImage: "/active.jpg", mobileImage: "/active-mobile.jpg", title: "Active", order: 1 },
      { desktopImage: "/expired.jpg", endsAt: "2026-09-27T00:00:00Z", order: 3 },
    ], now);

    expect(slides.map((slide) => slide.desktopImage)).toEqual(["/active.jpg", "/legacy.jpg"]);
    expect(slides[0]?.mobileImage).toBe("/active-mobile.jpg");
    expect(slides[0]?.altText).toBe("Active");
  });

  test("enforces an event publish window", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    expect(isEventActive({ isActive: true, startsAt: null, endsAt: null }, now)).toBe(true);
    expect(isEventActive({ isActive: false, startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isEventActive({ isActive: true, startsAt: new Date("2026-09-29T00:00:00Z"), endsAt: null }, now)).toBe(false);
    expect(isEventActive({ isActive: true, startsAt: null, endsAt: new Date("2026-09-27T00:00:00Z") }, now)).toBe(false);
  });

  test("returns only card-safe product data with the lowest purchasable price", () => {
    const card = toHomepageProduct({
      id: "product-id",
      slug: "sample",
      name: "Sample",
      nameKh: null,
      image: "/sample.jpg",
      type: "digital-service",
      region: null,
      isHot: true,
      isPopular: false,
      stock: true,
      cost: [
        { id: "disabled", price: "0.50", isActive: false },
        { id: "large", price: "5.00", costPrice: "6.00" },
        { id: "small", price: "2.00", costPrice: "3.00" },
      ],
    });

    expect(card.minPrice).toBe("2.00");
    expect(card.originalPrice).toBe("3.00");
    expect(card.inStock).toBe(true);
    expect(Object.keys(card)).not.toContain("cost");
  });
});
