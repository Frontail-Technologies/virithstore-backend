import { db, type Tx } from "../../db/client";
import { orderLogs, type NewOrderLog } from "../../db/schema/orderLogs";

/** Appends an audit entry; pass a transaction handle to make the entry part of the caller's transaction. */
export const recordOrderLog = (entry: NewOrderLog, executor: Pick<Tx, "insert"> = db) => executor.insert(orderLogs).values(entry);
