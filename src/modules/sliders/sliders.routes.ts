import { Elysia } from "elysia";
import { SlidersService } from "./sliders.service";
import { ok, created } from "../../shared/response";
import { requireAdmin } from "../../middleware/admin.middleware";

export const slidersRoutes = new Elysia({ prefix: "/sliders" })
  .get("/", async ({ query }) => {
    const type = (query as any)?.type;
    const list = await SlidersService.getAll(type);
    return ok(list);
  })
  .get("/type/:type", async ({ params }) => {
    const item = await SlidersService.getByType(params.type);
    return ok(item);
  })
  .use(requireAdmin)
  .get("/admin/all", async ({ query }) => {
    const type = (query as any)?.type;
    const list = await SlidersService.getAll(type);
    return ok(list);
  })
  .post("/", async ({ body }) => {
    const type = (body as any)?.type || "home";
    const item = await SlidersService.create((body as any)?.images || [], type);
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
