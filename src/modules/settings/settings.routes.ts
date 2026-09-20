import { Elysia, t } from "elysia";
import { SettingsService } from "./settings.service";
import { ok } from "../../shared/response";
import { requireAdmin } from "../../middleware/admin.middleware";

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .get("/", async () => {
    const all = await SettingsService.getAll();
    return ok(all);
  })
  .get("/:key", async ({ params }) => {
    const value = await SettingsService.getByKey(params.key);
    return ok(value);
  })
  .use(requireAdmin)
  .post(
    "/:key",
    async ({ params, body }) => {
      const result = await SettingsService.setKey(params.key, (body as any).value);
      return ok(result, "Setting updated successfully");
    },
    { body: t.Object({ value: t.Any() }) }
  )
  .post(
    "/admin/bulk",
    async ({ body }) => {
      const data = body as Record<string, any>;
      const promises = Object.entries(data).map(([key, value]) =>
        SettingsService.setKey(key, value)
      );
      await Promise.all(promises);
      return ok({}, "Settings saved successfully");
    }
  );
