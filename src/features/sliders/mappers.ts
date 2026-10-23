import type { Slider, SliderImage } from "../../db/schema/sliders";

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

/** Enabled, in-window slides sorted by `order`, reduced to the fields the storefront renders. */
export function getActiveHeroSlides(images: SliderImage[] = [], now = new Date()): PublicHeroSlide[] {
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

export const toPublicSlider = (slider: Slider) => ({
  id: slider.id,
  type: slider.type,
  images: getActiveHeroSlides(slider.images),
});
