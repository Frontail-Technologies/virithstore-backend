import { expect, test } from "bun:test";
import type { GiftProgressResponse } from "./gift.contract";

test("gift progress contract uses canonical wagering names", () => {
  const response: GiftProgressResponse = {
    totalSpent: "25.00",
    gifts: [{
      id: "gift-1", name: "Starter", image: null, requiredWagering: "20.00",
      rewardType: "discount", rewardValue: "5", isClaimed: false, isEligible: true, progress: 100,
    }],
  };
  expect(response.totalSpent).toBe("25.00");
  expect(response.gifts[0].requiredWagering).toBe("20.00");
  expect(response.gifts[0]).not.toHaveProperty("targetWager");
});
