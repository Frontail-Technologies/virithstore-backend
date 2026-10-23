/** Error carrying an HTTP status and machine-readable code; mapped to a response by plugins/error-handler. */
export type HttpError = Error & {
  name: "HttpError";
  statusCode: number;
  code: string;
  details?: unknown;
};

export function httpError(message: string, statusCode = 400, code = "BAD_REQUEST", details?: unknown): HttpError {
  return Object.assign(new Error(message), { name: "HttpError" as const, statusCode, code, details });
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && error.name === "HttpError";
}

export const badRequest = (message: string, details?: unknown) => httpError(message, 400, "BAD_REQUEST", details);
export const unauthorized = (message = "Unauthorized access") => httpError(message, 401, "UNAUTHORIZED");
export const forbidden = (message = "Access forbidden") => httpError(message, 403, "FORBIDDEN");
export const notFound = (message = "Resource not found") => httpError(message, 404, "NOT_FOUND");
export const conflict = (message: string) => httpError(message, 409, "CONFLICT");
export const validationError = (message: string, details: unknown) => httpError(message, 422, "VALIDATION_ERROR", details);
