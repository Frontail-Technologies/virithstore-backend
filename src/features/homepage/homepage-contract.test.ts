import { describe, expect, test } from "bun:test";
import { getActiveHeroSlides } from "../sliders/mappers";
import { isEventActive } from "../events/mappers";
import { toHomepageProduct } from "../products/mappers";

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
      isLink: false,
      link: "https://ignored.example",
    });

    expect(card.minPrice).toBe("2.00");
    expect(card.originalPrice).toBe("3.00");
    expect(card.inStock).toBe(true);
    expect(card.isLink).toBe(false);
    expect(card.link).toBeNull();
    expect(Object.keys(card)).not.toContain("cost");
  });

  test("a direct link product without packages stays clickable and exposes its link", () => {
    const card = toHomepageProduct({
      id: "link-id",
      slug: "join-group",
      name: "Join Group",
      nameKh: null,
      image: "/link.jpg",
      type: "digital-service",
      region: null,
      isHot: false,
      isPopular: false,
      stock: true,
      cost: [],
      isLink: true,
      link: "https://t.me/example",
    });

    expect(card.inStock).toBe(true);
    expect(card.isLink).toBe(true);
    expect(card.link).toBe("https://t.me/example");
  });
});
