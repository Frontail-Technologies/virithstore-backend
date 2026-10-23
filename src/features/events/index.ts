import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { CreateEvent, UpdateEvent } from "./model";
import { createEvent, deleteEvent, listActiveEvents, listEvents, updateEvent } from "./service";

export const eventsFeature = new Elysia({ prefix: "/events", name: "feature.events", tags: ["Events"] })
  .use(authPlugin)
  .get("/", async () => ok(await listActiveEvents()))
  .get("/admin/all", async () => ok(await listEvents()), { admin: true })
  .post("/", async ({ body }) => created(await createEvent(body), "Event created successfully"), {
    admin: true,
    body: CreateEvent,
  })
  .put("/:id", async ({ params, body }) => ok(await updateEvent(params.id, body), "Event updated successfully"), {
    admin: true,
    params: IdParam,
    body: UpdateEvent,
  })
  .delete("/:id", async ({ params }) => ok(await deleteEvent(params.id), "Event deleted successfully"), {
    admin: true,
    params: IdParam,
  });
