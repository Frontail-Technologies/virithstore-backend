import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

const isConfigured = !!env.CLOUDINARY_CLOUD_NAME;

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

const DATA_URI_RE = /^data:([a-zA-Z0-9+.-]+\/[a-zA-Z0-9+.-]+);base64,/;

export function isDataUri(value: unknown): value is string {
  return typeof value === "string" && DATA_URI_RE.test(value);
}

/** Uploads a base64 data URI (or raw buffer) to Cloudinary with compression, or falls back to local disk storage when Cloudinary isn't configured. */
export async function uploadImage(
  input: string | Buffer,
  folder = "virithstore",
  mimeType = "image/png",
): Promise<string> {
  const dataUri =
    typeof input === "string"
      ? input
      : `data:${mimeType};base64,${input.toString("base64")}`;

  if (isConfigured) {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: "image",
      quality: "auto:good",
      fetch_format: "auto",
      width: 1600,
      crop: "limit",
    });
    return result.secure_url;
  }

  const match = dataUri.match(DATA_URI_RE);
  const ext = (match?.[1].split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const buffer = Buffer.from(base64, "base64");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await Bun.write(`./public/uploads/${filename}`, buffer);
  return `/uploads/${filename}`;
}

export async function resolveImages<T>(
  value: T,
  folder: string,
  cache: Map<string, Promise<string>> = new Map(),
): Promise<T> {
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((v) => resolveImages(v, folder, cache)),
    ) as any;
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([k, v]) => [
        k,
        await resolveImages(v, folder, cache),
      ]),
    );
    return Object.fromEntries(entries) as any;
  }
  if (isDataUri(value)) {
    let pending = cache.get(value);
    if (!pending) {
      pending = uploadImage(value, folder);
      cache.set(value, pending);
    }
    return (await pending) as any;
  }
  return value;
}
