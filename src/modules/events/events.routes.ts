import { Elysia } from "elysia";
import { EventsService } from "./events.service";
import { ok, created } from "../../shared/response";
import { requireAdmin } from "../../middleware/admin.middleware";

export const eventsRoutes = new Elysia({ prefix: "/events" })
  .get("/", async () => {
    const list = await EventsService.getActive();
    return ok(list);
  })
  .use(requireAdmin)
  .get("/admin/all", async () => {
    const list = await EventsService.getAll();
    return ok(list);
  })
  .post("/", async ({ body }) => {
    const item = await EventsService.create(body as any);
    return created(item, "Event created successfully");
  })
  .put("/:id", async ({ params, body }) => {
    const item = await EventsService.update(params.id, body as any);
    return ok(item, "Event updated successfully");
  })
  .delete("/:id", async ({ params }) => {
    const deleted = await EventsService.delete(params.id);
    return ok(deleted, "Event deleted successfully");
  });
