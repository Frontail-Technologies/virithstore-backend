import { describe, expect, test } from "bun:test";
import { pickWeightedPrize } from "./selection";

const prizes = [
  { name: "common", probability: 70 },
  { name: "rare", probability: 25 },
  { name: "jackpot", probability: 5 },
];

describe("pickWeightedPrize", () => {
  test("maps the roll onto cumulative weights", () => {
    expect(pickWeightedPrize(prizes, 0).name).toBe("common");
    expect(pickWeightedPrize(prizes, 0.69).name).toBe("common");
    expect(pickWeightedPrize(prizes, 0.7).name).toBe("rare");
    expect(pickWeightedPrize(prizes, 0.94).name).toBe("rare");
    expect(pickWeightedPrize(prizes, 0.96).name).toBe("jackpot");
    expect(pickWeightedPrize(prizes, 0.999999).name).toBe("jackpot");
  });

  test("always returns one of the prizes for random rolls", () => {
    for (let i = 0; i < 200; i++) expect(prizes).toContain(pickWeightedPrize(prizes));
  });
});
