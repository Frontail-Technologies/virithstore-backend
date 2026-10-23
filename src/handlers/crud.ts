import { eq, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "../db/client";
import { notFound } from "../libs/http-error";

type TableWithId = PgTable & { id: any };

interface CrudOptions {
  /** Used in "<label> not found". */
  label: string;
  orderBy?: SQL | SQL[];
}

/**
 * Typed CRUD functions for a plain table (id primary key, optional `updatedAt`).
 * Features call these from their own explicit routes, so Eden keeps precise per-route types.
 */
export function createCrudService<T extends TableWithId>(table: T, options: CrudOptions) {
  type Row = T["$inferSelect"];
  type Insert = T["$inferInsert"];
  const t = table as any;
  const orders = options.orderBy ? [options.orderBy].flat() : [];

  const list = async (): Promise<Row[]> => {
    const query = db.select().from(table as PgTable);
    return (orders.length ? await query.orderBy(...orders) : await query) as Row[];
  };

  const getById = async (id: string): Promise<Row> => {
    const [row] = await db.select().from(table as PgTable).where(eq(t.id, id)).limit(1);
    if (!row) throw notFound(`${options.label} not found`);
    return row as Row;
  };

  const create = async (data: Insert): Promise<Row> => {
    const [row] = await db.insert(table).values(data).returning();
    return row as Row;
  };

  const update = async (id: string, data: Partial<Insert>): Promise<Row> => {
    const values = "updatedAt" in t ? { ...data, updatedAt: new Date() } : data;
    const [row] = await db.update(table).set(values as any).where(eq(t.id, id)).returning();
    if (!row) throw notFound(`${options.label} not found`);
    return row as Row;
  };

  const remove = async (id: string): Promise<Row> => {
    const [row] = await db.delete(table).where(eq(t.id, id)).returning();
    if (!row) throw notFound(`${options.label} not found`);
    return row as Row;
  };

  return { list, getById, create, update, remove };
}
