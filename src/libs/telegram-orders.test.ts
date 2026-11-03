import { describe, expect, test } from "bun:test";
import type { Order } from "../db/schema/orders";
import { alertKindFor, escapeTelegramHtml, formatOrderMessage, orderButtons, parseOrderCallback } from "./telegram-orders";

const ORDER_ID = "66666666-6666-4666-8666-666666666666";
const order = {
  id: ORDER_ID, userId: null, orderNumber: "ORD-9", productId: null, productName: "Spotify <Premium>",
  productImage: null, productType: "account", packageId: "m1", packageName: "1 month", price: "2.5",
  originalPrice: "2.5", couponCode: null, discount: "0.00", status: "completed", paymentMethod: "aba-khqr",
  paymentStatus: "paid", paymentTransactionId: "TXN", credentials: { email: "buyer@example.com" },
  deliveryData: { email: "acc@example.com", password: "SuperSecret1" }, notes: null, refundRequired: false,
  telegramChatId: null, telegramMessageId: null, telegramNotifiedAt: null, couponRedeemedAt: null,
  fulfilledAt: new Date(), userEmail: "buyer@example.com", createdAt: new Date(), updatedAt: new Date(),
} satisfies Order;

describe("Telegram order formatting", () => {
  test("escapes user-controlled HTML", () => {
    expect(escapeTelegramHtml(`<a href="x">A&B</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;A&amp;B&lt;/a&gt;");
  });

  test("never puts the delivered account password in the chat", () => {
    const text = formatOrderMessage(order, "delivered");
    expect(text).not.toContain("SuperSecret1");
    expect(text).toContain("Spotify &lt;Premium&gt;");
    expect(text).toContain("$2.50");
  });

  test("picks the alert kind from the paid order state", () => {
    expect(alertKindFor(order)).toBe("delivered");
    expect(alertKindFor({ productType: "account", status: "pending" })).toBe("needs-account");
    expect(alertKindFor({ productType: "digital-service", status: "processing" })).toBe("manual");
  });

  test("delivered orders only offer Cancel; others offer Complete and Cancel", () => {
    expect(orderButtons(order, "delivered").flat().map((b) => b.callback_data)).toEqual([`ord-cancel:${ORDER_ID}`]);
    expect(orderButtons(order, "needs-account").flat().map((b) => b.callback_data))
      .toEqual([`ord-complete:${ORDER_ID}`, `ord-cancel:${ORDER_ID}`]);
  });

  test("final message flags a manual refund", () => {
    const text = formatOrderMessage({ ...order, status: "cancelled", refundRequired: true }, "delivered", "cancelled");
    expect(text).toContain("CANCELLED");
    expect(text).toContain("Refund required");
  });
});

describe("Telegram callback parsing", () => {
  test("reads new and legacy button data", () => {
    expect(parseOrderCallback(`ord-complete:${ORDER_ID}`)).toEqual({ action: "complete", orderId: ORDER_ID });
    expect(parseOrderCallback(`ord-cancel:${ORDER_ID}`)).toEqual({ action: "cancel", orderId: ORDER_ID });
    expect(parseOrderCallback(`manual-complete:${ORDER_ID}`)).toEqual({ action: "complete", orderId: ORDER_ID });
    expect(parseOrderCallback(`manual-failed:${ORDER_ID}`)).toEqual({ action: "cancel", orderId: ORDER_ID });
  });

  test("rejects anything else", () => {
    expect(parseOrderCallback("ord-delete:" + ORDER_ID)).toBeNull();
    expect(parseOrderCallback("ord-complete:not-a-uuid")).toBeNull();
  });
});
