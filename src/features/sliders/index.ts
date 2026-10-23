import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { created, ok } from "../../libs/response";
import { IdParam } from "../../handlers/params";
import { CreateSlider, TypeParam, TypeQuery, UpdateSlider } from "./model";
import { toPublicSlider } from "./mappers";
import { createSlider, deleteSlider, getSliderByType, listSliders, updateSliderImages } from "./service";

export const slidersFeature = new Elysia({ prefix: "/sliders", name: "feature.sliders", tags: ["Sliders"] })
  .use(authPlugin)
  .get("/", async ({ query }) => ok((await listSliders(query.type)).map(toPublicSlider)), { query: TypeQuery })
  .get(
    "/type/:type",
    async ({ params }) => {
      const slider = await getSliderByType(params.type);
      return ok(slider ? toPublicSlider(slider) : null);
    },
    { params: TypeParam },
  )
  .get("/admin/all", async ({ query }) => ok(await listSliders(query.type)), { admin: true, query: TypeQuery })
  .post("/", async ({ body }) => created(await createSlider(body.images, body.type), "Slider created successfully"), {
    admin: true,
    body: CreateSlider,
  })
  .put("/:id", async ({ params, body }) => ok(await updateSliderImages(params.id, body.images ?? []), "Slider updated successfully"), {
    admin: true,
    params: IdParam,
    body: UpdateSlider,
  })
  .delete("/:id", async ({ params }) => ok(await deleteSlider(params.id), "Slider deleted successfully"), {
    admin: true,
    params: IdParam,
  });
