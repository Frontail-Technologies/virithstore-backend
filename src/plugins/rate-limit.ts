import { rateLimit } from "elysia-rate-limit";
import { fail } from "../libs/response";

/** Client IP, preferring the forwarded address because the Next.js proxy sits in front of this server. */
const clientKey = (request: Request, server: { requestIP(req: Request): { address: string } | null } | null) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  server?.requestIP(request)?.address ||
  "unknown";

/** Per-client limiter. Each call gets its own counter, so limits are tracked per route group. */
export const rateLimiter = (max: number, durationMs = 60_000) =>
  rateLimit({
    max,
    duration: durationMs,
    scoping: "scoped",
    generator: (request, server) => clientKey(request, server as any),
    errorResponse: new Response(JSON.stringify(fail("Too many requests, please try again later", { code: "RATE_LIMITED" })), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(durationMs / 1000)) },
    }),
  });
