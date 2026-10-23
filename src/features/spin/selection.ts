import { randomInt } from "node:crypto";

/**
 * Picks a prize with chance proportional to its `probability` weight.
 * `roll` is injected so the selection is deterministic in tests.
 */
export function pickWeightedPrize<T extends { probability: number }>(prizes: T[], roll = randomInt(0, 1_000_000) / 1_000_000): T {
  const totalWeight = prizes.reduce((sum, prize) => sum + prize.probability, 0);
  let remaining = roll * totalWeight;
  for (const prize of prizes) {
    if (remaining < prize.probability) return prize;
    remaining -= prize.probability;
  }
  return prizes[prizes.length - 1];
}
