import type { Order } from "../../db/schema/orders";
import { forbidden, unauthorized } from "../../libs/http-error";
import { verifyCheckoutToken } from "../../libs/jwt";

/**
 * Owners (logged-in) or holders of the guest checkout token for that order may read it.
 * Throws 401 when no credentials were presented at all, 403 otherwise.
 */
export function assertOrderAccess(
  order: Pick<Order, "id" | "userId">,
  userId: string | undefined,
  checkoutToken: string | undefined,
): void {
  if (order.userId && order.userId === userId) return;
  if (!order.userId && verifyCheckoutToken(checkoutToken, order.id)) return;
  if (!userId && !checkoutToken) throw unauthorized("Order access token required");
  throw forbidden("You cannot access this order");
}
