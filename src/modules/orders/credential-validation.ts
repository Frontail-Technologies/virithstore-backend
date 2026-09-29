import type { ProductFieldItem } from "../../db/schema/products";
import { ValidationError } from "../../shared/errors";

export interface CredentialValidationIssue {
  field: string;
  code: "required" | "invalid_type" | "invalid_email" | "invalid_url" | "invalid_option" | "unsupported";
  message: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(
  fields: ProductFieldItem[],
  input: unknown,
): Record<string, string | number> {
  const credentials = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const issues: CredentialValidationIssue[] = [];
  const configuredNames = new Set(fields.map((field) => field.name));

  for (const key of Object.keys(credentials)) {
    if (!configuredNames.has(key)) {
      issues.push({ field: key, code: "unsupported", message: "This credential field is not supported" });
    }
  }

  const normalized: Record<string, string | number> = {};
  for (const field of fields) {
    const raw = credentials[field.name];
    const missing = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (missing) {
      if (field.required) {
        issues.push({ field: field.name, code: "required", message: `${field.label} is required` });
      }
      continue;
    }

    if (field.type === "number") {
      const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
      if (!Number.isFinite(value)) {
        issues.push({ field: field.name, code: "invalid_type", message: `${field.label} must be a number` });
      } else {
        normalized[field.name] = value;
      }
      continue;
    }

    if (typeof raw !== "string") {
      issues.push({ field: field.name, code: "invalid_type", message: `${field.label} must be text` });
      continue;
    }

    const value = raw.trim();
    if (field.type === "email" && !emailPattern.test(value)) {
      issues.push({ field: field.name, code: "invalid_email", message: `${field.label} must be a valid email address` });
    } else if (field.type === "url") {
      try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
        normalized[field.name] = value;
      } catch {
        issues.push({ field: field.name, code: "invalid_url", message: `${field.label} must be a valid HTTP or HTTPS URL` });
      }
    } else if (field.type === "select" && !(field.options || []).includes(value)) {
      issues.push({ field: field.name, code: "invalid_option", message: `Select a valid ${field.label} option` });
    } else {
      normalized[field.name] = value;
    }
  }

  if (issues.length > 0) {
    throw new ValidationError("Please correct the highlighted buyer information", issues);
  }
  return normalized;
}
