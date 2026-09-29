import { describe, expect, test } from "bun:test";
import { validateCredentials } from "./credential-validation";
import { assertOrderAccess, createCheckoutToken, toPublicOrderStatusDto, verifyCheckoutToken } from "./checkout-access";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../../shared/errors";
import type { Order } from "../../db/schema/orders";
import type { ProductFieldItem } from "../../db/schema/products";

const fields: ProductFieldItem[] = [
  { name: "playerId", label: "Player ID", type: "text", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "profile", label: "Profile URL", type: "url" },
  { name: "server", label: "Server", type: "select", required: true, options: ["Asia", "Europe"] },
  { name: "accountLevel", label: "Account Level", type: "number" },
];

describe("product credential validation", () => {
  test("rejects a missing required credential with field details", () => {
    expect(() => validateCredentials(fields, {})).toThrow(ValidationError);
    try { validateCredentials(fields, {}); } catch (error) {
      expect((error as ValidationError).details).toContainEqual(expect.objectContaining({ field: "playerId", code: "required" }));
    }
  });

  test("accepts configured credentials without external account verification", () => {
    expect(validateCredentials(fields, {
      playerId: " 12345 ", email: "player@example.com", profile: "https://example.com/u/1", server: "Asia", accountLevel: "42",
    })).toEqual({ playerId: "12345", email: "player@example.com", profile: "https://example.com/u/1", server: "Asia", accountLevel: 42 });
  });

  test("rejects invalid select options", () => {
    expect(() => validateCredentials(fields, { playerId: "1", email: "a@b.com", server: "Mars" })).toThrow(ValidationError);
  });

  test("rejects malformed email and URL values", () => {
    try { validateCredentials(fields, { playerId: "1", email: "bad", profile: "javascript:alert(1)", server: "Asia" }); } catch (error) {
      const details = (error as ValidationError).details as Array<{ code: string }>;
      expect(details.map((item) => item.code)).toEqual(expect.arrayContaining(["invalid_email", "invalid_url"]));
    }
  });

  test("rejects credential keys not configured by the product", () => {
    expect(() => validateCredentials([], { admin: "true" })).toThrow(ValidationError);
  });
});

describe("order-scoped checkout access", () => {
  const ownedOrder = { id: "11111111-1111-4111-8111-111111111111", userId: "user-1" };
  const guestOrder = { id: "22222222-2222-4222-8222-222222222222", userId: null };

  test("allows an owner and blocks another authenticated user", () => {
    expect(() => assertOrderAccess(ownedOrder, "user-1", undefined)).not.toThrow();
    expect(() => assertOrderAccess(ownedOrder, "user-2", undefined)).toThrow(ForbiddenError);
  });

  test("a guest token only grants its bound order", () => {
    const token = createCheckoutToken(guestOrder.id);
    expect(verifyCheckoutToken(token, guestOrder.id)).toBe(true);
    expect(verifyCheckoutToken(token, "33333333-3333-4333-8333-333333333333")).toBe(false);
    expect(() => assertOrderAccess(guestOrder, undefined, token)).not.toThrow();
    expect(() => assertOrderAccess({ ...guestOrder, id: "other" }, undefined, token)).toThrow(ForbiddenError);
  });

  test("blocks anonymous arbitrary order and payment-status polling", () => {
    expect(() => assertOrderAccess(guestOrder, undefined, undefined)).toThrow(UnauthorizedError);
  });

  test("public lookup DTO omits credentials, delivery, user, and provider fields", () => {
    const dto = toPublicOrderStatusDto({
      ...guestOrder,
      orderNumber: "ORD-1", productId: null, productName: "Product", productImage: null,
      productType: "digital-service", packageId: "p1", packageName: "Pack", price: "1.00",
      originalPrice: "1.00", couponCode: null, discount: "0.00", status: "pending",
      paymentMethod: "aba-khqr", paymentStatus: "pending", paymentTransactionId: "secret",
      credentials: { playerId: "secret" }, deliveryData: { password: "secret" }, notes: null,
      couponRedeemedAt: null, fulfilledAt: null, userEmail: "secret@example.com", createdAt: new Date(), updatedAt: new Date(),
    } satisfies Order);
    expect(dto).not.toHaveProperty("credentials");
    expect(dto).not.toHaveProperty("deliveryData");
    expect(dto).not.toHaveProperty("paymentTransactionId");
    expect(dto).not.toHaveProperty("userEmail");
  });
});
