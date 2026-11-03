import { describe, expect, test } from "bun:test";
import { validateCredentials } from "./credentials";
import { assertOrderAccess } from "./access";
import { toOrderStatusDto, toPublicOrderStatusDto } from "./mappers";
import { hasDeliveredCredentials } from "./status";
import { createCheckoutToken, verifyCheckoutToken } from "../../libs/jwt";
import type { HttpError } from "../../libs/http-error";
import type { Order } from "../../db/schema/orders";
import type { ProductFieldItem } from "../../db/schema/products";

const fields: ProductFieldItem[] = [
  { name: "playerId", label: "Player ID", type: "text", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "profile", label: "Profile URL", type: "url" },
  { name: "server", label: "Server", type: "select", required: true, options: ["Asia", "Europe"] },
  { name: "accountLevel", label: "Account Level", type: "number" },
];

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error as HttpError;
  }
};

describe("product credential validation", () => {
  test("rejects a missing required credential with field details", () => {
    expect(errorOf(() => validateCredentials(fields, {}))?.code).toBe("VALIDATION_ERROR");
    try { validateCredentials(fields, {}); } catch (error) {
      expect((error as HttpError).details).toContainEqual(expect.objectContaining({ field: "playerId", code: "required" }));
    }
  });

  test("accepts configured credentials without external account verification", () => {
    expect(validateCredentials(fields, {
      playerId: " 12345 ", email: "player@example.com", profile: "https://example.com/u/1", server: "Asia", accountLevel: "42",
    })).toEqual({ playerId: "12345", email: "player@example.com", profile: "https://example.com/u/1", server: "Asia", accountLevel: 42 });
  });

  test("rejects invalid select options", () => {
    expect(errorOf(() => validateCredentials(fields, { playerId: "1", email: "a@b.com", server: "Mars" }))?.code).toBe("VALIDATION_ERROR");
  });

  test("rejects malformed email and URL values", () => {
    try { validateCredentials(fields, { playerId: "1", email: "bad", profile: "javascript:alert(1)", server: "Asia" }); } catch (error) {
      const details = (error as HttpError).details as Array<{ code: string }>;
      expect(details.map((item) => item.code)).toEqual(expect.arrayContaining(["invalid_email", "invalid_url"]));
    }
  });

  test("rejects credential keys not configured by the product", () => {
    expect(errorOf(() => validateCredentials([], { admin: "true" }))?.code).toBe("VALIDATION_ERROR");
  });
});

describe("order-scoped checkout access", () => {
  const ownedOrder = { id: "11111111-1111-4111-8111-111111111111", userId: "user-1" };
  const guestOrder = { id: "22222222-2222-4222-8222-222222222222", userId: null };

  test("allows an owner and blocks another authenticated user", () => {
    expect(() => assertOrderAccess(ownedOrder, "user-1", undefined)).not.toThrow();
    expect(errorOf(() => assertOrderAccess(ownedOrder, "user-2", undefined))?.code).toBe("FORBIDDEN");
  });

  test("a guest token only grants its bound order", () => {
    const token = createCheckoutToken(guestOrder.id);
    expect(verifyCheckoutToken(token, guestOrder.id)).toBe(true);
    expect(verifyCheckoutToken(token, "33333333-3333-4333-8333-333333333333")).toBe(false);
    expect(() => assertOrderAccess(guestOrder, undefined, token)).not.toThrow();
    expect(errorOf(() => assertOrderAccess({ ...guestOrder, id: "other" }, undefined, token))?.code).toBe("FORBIDDEN");
  });

  test("blocks anonymous arbitrary order and payment-status polling", () => {
    expect(errorOf(() => assertOrderAccess(guestOrder, undefined, undefined))?.code).toBe("UNAUTHORIZED");
  });

  test("public lookup DTO omits credentials, delivery, user, and provider fields", () => {
    const dto = toPublicOrderStatusDto({
      ...guestOrder,
      orderNumber: "ORD-1", productId: null, productName: "Product", productImage: null,
      productType: "digital-service", packageId: "p1", packageName: "Pack", price: "1.00",
      originalPrice: "1.00", couponCode: null, discount: "0.00", status: "pending",
      paymentMethod: "aba-khqr", paymentStatus: "pending", paymentTransactionId: "secret",
      credentials: { playerId: "secret" }, deliveryData: { password: "secret" }, notes: null, refundRequired: false,
      telegramChatId: null, telegramMessageId: null, telegramNotifiedAt: null,
      couponRedeemedAt: null, fulfilledAt: null, userEmail: "secret@example.com", createdAt: new Date(), updatedAt: new Date(),
    } satisfies Order);
    expect(dto).not.toHaveProperty("credentials");
    expect(dto).not.toHaveProperty("deliveryData");
    expect(dto).not.toHaveProperty("paymentTransactionId");
    expect(dto).not.toHaveProperty("userEmail");
  });
});

describe("buyer order DTO", () => {
  const base = {
    id: "44444444-4444-4444-8444-444444444444", userId: "user-1", orderNumber: "ORD-2", productId: null,
    productName: "Netflix", productImage: null, productType: "account", packageId: "m1", packageName: "1 month",
    price: "3.00", originalPrice: "3.00", couponCode: null, discount: "0.00", status: "pending" as Order["status"],
    paymentMethod: "aba-khqr", paymentStatus: "pending" as Order["paymentStatus"], paymentTransactionId: "TXN1",
    credentials: {}, deliveryData: { reservedAccountId: "55555555-5555-4555-8555-555555555555" } as unknown, notes: null,
    refundRequired: false, telegramChatId: null, telegramMessageId: null, telegramNotifiedAt: null,
    couponRedeemedAt: null, fulfilledAt: null, userEmail: null, createdAt: new Date(), updatedAt: new Date(),
  } satisfies Order;

  test("never exposes the internal account hold of an unpaid order", () => {
    expect(toOrderStatusDto(base).deliveredCredentials).toBeNull();
  });

  test("hides delivery while a paid order still waits for an account", () => {
    expect(toOrderStatusDto({ ...base, paymentStatus: "paid", deliveryData: null }).deliveredCredentials).toBeNull();
  });

  test("shows credentials once the order is completed", () => {
    const delivered = { email: "a@b.com", password: "pw", additionalInfo: null };
    expect(toOrderStatusDto({ ...base, paymentStatus: "paid", status: "completed", deliveryData: delivered }).deliveredCredentials)
      .toEqual(delivered);
  });

  test("tells the buyer a cancelled paid order is waiting for a refund", () => {
    expect(toOrderStatusDto({ ...base, paymentStatus: "paid", status: "cancelled", refundRequired: true }).refundRequired).toBe(true);
  });

  test("an account hold placeholder does not count as delivered credentials", () => {
    expect(hasDeliveredCredentials({ reservedAccountId: "x" })).toBe(false);
    expect(hasDeliveredCredentials({ email: " " })).toBe(false);
    expect(hasDeliveredCredentials({ email: "a@b.com", password: "pw" })).toBe(true);
  });
});
