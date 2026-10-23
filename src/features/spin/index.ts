import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { CreatePrize, UpdatePrize, UpdateSpinStatus } from "./model";
import {
  countAvailableCredits,
  createPrize,
  deletePrize,
  listActivePrizes,
  listAllPrizes,
  listAllSpinHistory,
  listUserSpinHistory,
  playSpin,
  updatePrize,
  updateSpinStatus,
} from "./service";

export const spinFeature = new Elysia({ prefix: "/spin", name: "feature.spin", tags: ["Spin"] })
  .use(authPlugin)
  .get("/prizes", async () => ok(await listActivePrizes()))
  .post("/play", async ({ user }) => ok(await playSpin(user.id), "Spin completed!"), { auth: true })
  .get("/my-credits", async ({ user }) => ok({ credits: await countAvailableCredits(user.id) }), { auth: true })
  .get("/my-history", async ({ user }) => ok(await listUserSpinHistory(user.id)), { auth: true })
  .get("/admin/prizes", async () => ok(await listAllPrizes()), { admin: true })
  .get("/admin/history", async () => ok(await listAllSpinHistory()), { admin: true })
  .post("/admin/prizes", async ({ body }) => created(await createPrize(body), "Prize created successfully"), {
    admin: true,
    body: CreatePrize,
  })
  .put("/admin/prizes/:id", async ({ params, body }) => ok(await updatePrize(params.id, body), "Prize updated successfully"), {
    admin: true,
    params: IdParam,
    body: UpdatePrize,
  })
  .delete("/admin/prizes/:id", async ({ params }) => ok(await deletePrize(params.id), "Prize deleted successfully"), {
    admin: true,
    params: IdParam,
  })
  .put("/update-status", async ({ body }) => ok(await updateSpinStatus(body.id, body.status), "Status updated successfully"), {
    admin: true,
    body: UpdateSpinStatus,
  });
