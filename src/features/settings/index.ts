import { Elysia } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { ok } from "../../libs/response";
import { SetSetting, SetSettings, SettingKeyParam } from "./model";
import { getAllSettings, getPublicSetting, getPublicSettings, setSetting, setSettings } from "./service";

export const settingsFeature = new Elysia({ prefix: "/settings", name: "feature.settings", tags: ["Settings"] })
  .use(authPlugin)
  .get("/", async () => ok(await getPublicSettings()))
  .get("/admin/all", async () => ok(await getAllSettings()), { admin: true })
  .post(
    "/admin/bulk",
    async ({ body }) => {
      await setSettings(body);
      return ok({}, "Settings saved successfully");
    },
    { admin: true, body: SetSettings },
  )
  .get("/:key", async ({ params }) => ok(await getPublicSetting(params.key)), { params: SettingKeyParam })
  .post("/:key", async ({ params, body }) => ok(await setSetting(params.key, body.value), "Setting updated successfully"), {
    admin: true,
    params: SettingKeyParam,
    body: SetSetting,
  });
