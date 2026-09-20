import { Elysia, t } from "elysia";
import { uploadImage } from "../../shared/cloudinary";
import { ok, fail } from "../../shared/response";
import { requireAdmin } from "../../middleware/admin.middleware";

export const uploadRoutes = new Elysia({ prefix: "/upload" })
  .use(requireAdmin)
  .post(
    "/image",
    async ({ body }) => {
      try {
        const file = (body as any).file as File;
        const buffer = Buffer.from(await file.arrayBuffer());
        const url = await uploadImage(buffer, "virithstore", file.type);
        return ok({ url }, "Image uploaded successfully");
      } catch (error: any) {
        return fail(`Upload failed: ${error.message}`);
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  );
