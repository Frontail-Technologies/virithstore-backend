import { describe, expect, test } from "bun:test";
import { mergeAccountInventory } from "./service";

describe("account package inventory", () => {
  const accountProduct = {
    id: "product-1",
    type: "account" as const,
    cost: [
      { id: "monthly", price: "3.50", inStock: true },
      { id: "yearly", price: "30.00", inStock: true },
    ],
  };

  test("marks an account package unavailable when the vault has no matching credentials", () => {
    const product = mergeAccountInventory(accountProduct, new Map());
    expect(product.cost[0]).toMatchObject({ availableStock: 0, inventoryAvailable: false });
    expect(product.cost[1]).toMatchObject({ availableStock: 0, inventoryAvailable: false });
  });

  test("reports the available credential count per package", () => {
    const product = mergeAccountInventory(accountProduct, new Map([
      ["product-1:monthly", 2],
      ["product-1:yearly", 1],
    ]));
    expect(product.cost[0]).toMatchObject({ availableStock: 2, inventoryAvailable: true });
    expect(product.cost[1]).toMatchObject({ availableStock: 1, inventoryAvailable: true });
  });

  test("does not add vault availability to digital-service products", () => {
    const digitalProduct = { ...accountProduct, type: "digital-service" as const };
    expect(mergeAccountInventory(digitalProduct, new Map())).toBe(digitalProduct);
  });
});
