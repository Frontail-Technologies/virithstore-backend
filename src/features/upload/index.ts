import { Elysia, t } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { uploadImage } from "../../libs/cloudinary";
import { httpError } from "../../libs/http-error";
import { ok } from "../../libs/response";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export const uploadFeature = new Elysia({ prefix: "/upload", name: "feature.upload", tags: ["Upload"] })
  .use(authPlugin)
  .post(
    "/image",
    async ({ body }) => {
      const { file, folder } = body;
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw httpError("Only JPEG, PNG, WebP, GIF or AVIF images are allowed", 415);
      }
      if (file.size > MAX_IMAGE_BYTES) throw httpError("Image must be smaller than 10MB", 413);

      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadImage(buffer, `virithstore/${folder ?? "misc"}`, file.type);
      return ok({ url }, "Image uploaded successfully");
    },
    {
      admin: true,
      body: t.Object({
        file: t.File(),
        folder: t.Optional(t.String({ pattern: "^[a-z0-9_-]{1,40}$" })),
      }),
    },
  );
