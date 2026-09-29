import { Elysia } from "elysia";
import { ok } from "../../shared/response";
import { HomepageService } from "./homepage.service";

export const homepageRoutes = new Elysia({ prefix: "/homepage" })
  .get("/", async ({ set }) => {
    set.headers["cache-control"] = "public, max-age=30, stale-while-revalidate=120";
    return ok(await HomepageService.get());
  });
