import { Elysia } from "elysia";
import { isHttpError } from "../libs/http-error";
import { fail } from "../libs/response";

const PG_CLIENT_ERROR_CODES: Record<string, { status: number; message: string }> = {
  "22P02": { status: 400, message: "Invalid ID or parameter format" },
  "23505": { status: 409, message: "This value already exists" },
  "23503": { status: 400, message: "Referenced record does not exist" },
  "23502": { status: 400, message: "A required field is missing" },
  "22007": { status: 400, message: "Invalid date/time format" },
};

/** Single error-to-response mapping shared by the app and by tests that mount individual route modules. */
export const errorHandler = new Elysia({ name: "error-handler" }).onError({ as: "global" }, ({ code, error, set }) => {
  if (isHttpError(error)) {
    set.status = error.statusCode;
    return fail(error.message, { code: error.code, details: error.details });
  }

  if (code === "VALIDATION") {
    set.status = 422;
    const issues = ((error as any).all ?? []).map((e: any) => ({ path: e.path, message: e.message }));
    return fail("Invalid request data", { code: "VALIDATION_ERROR", details: issues });
  }

  if (code === "NOT_FOUND") {
    set.status = 404;
    return fail("Endpoint not found", { code: "NOT_FOUND" });
  }

  if (code === "PARSE") {
    set.status = 400;
    return fail("Malformed request body", { code: "BAD_REQUEST" });
  }

  const pgCode = (error as any)?.cause?.code || (error as any)?.code;
  const pgError = typeof pgCode === "string" ? PG_CLIENT_ERROR_CODES[pgCode] : undefined;

  console.error("Unhandled Error:", error);

  if (pgError) {
    set.status = pgError.status;
    return fail(pgError.message, { code: "BAD_REQUEST" });
  }

  set.status = 500;
  return fail("Internal server error", { code: "INTERNAL_ERROR" });
});
