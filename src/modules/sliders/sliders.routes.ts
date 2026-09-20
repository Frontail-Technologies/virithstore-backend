import { Elysia } from "elysia";
import { SlidersService } from "./sliders.service";
import { ok, created } from "../../shared/response";
import { requireAdmin } from "../../middleware/admin.middleware";

export const slidersRoutes = new Elysia({ prefix: "/sliders" })
  .get("/", async () => {
    const list = await SlidersService.getAll();
    return ok(list);
  })
  .use(requireAdmin)
  .get("/admin/all", async () => {
    const list = await SlidersService.getAll();
    return ok(list);
  })
  .post("/", async ({ body }) => {
    const item = await SlidersService.create((body as any)?.images || []);
    return created(item, "Slider created successfully");
  })
  .put("/:id", async ({ params, body }) => {
    const item = await SlidersService.updateImages(params.id, (body as any)?.images || []);
    return ok(item, "Slider updated successfully");
  })
  .delete("/:id", async ({ params }) => {
    const deleted = await SlidersService.delete(params.id);
    return ok(deleted, "Slider deleted successfully");
  });
