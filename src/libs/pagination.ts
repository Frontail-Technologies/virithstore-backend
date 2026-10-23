export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Clamps untrusted page/limit input into safe values and the matching SQL offset. */
export function parsePage(input: { page?: unknown; limit?: unknown }, options: { defaultLimit?: number; maxLimit?: number } = {}) {
  const { defaultLimit = 50, maxLimit = 100 } = options;
  const page = Math.max(Math.floor(Number(input.page)) || 1, 1);
  const limit = Math.min(Math.max(Math.floor(Number(input.limit)) || defaultLimit, 1), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

export function toPageMeta(total: number, page: number, limit: number): PageMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Same clamping for `limit`/`offset` style queries (wallet and referral lists). */
export function parseOffset(input: { limit?: unknown; offset?: unknown }, options: { defaultLimit?: number; maxLimit?: number } = {}) {
  const { defaultLimit = 50, maxLimit = 100 } = options;
  const limit = Math.min(Math.max(Math.floor(Number(input.limit)) || defaultLimit, 1), maxLimit);
  const offset = Math.max(Math.floor(Number(input.offset)) || 0, 0);
  return { limit, offset };
}
