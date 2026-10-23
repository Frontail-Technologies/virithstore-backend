import type { Gift } from "../../db/schema/gifts";
import type { GiftProgressItem } from "./model";

/** Public gift: never exposes who claimed it. */
export function toPublicGift({ claimedBy: _claimedBy, ...gift }: Gift) {
  return gift;
}

export function toGiftProgress(gift: Gift, userId: string, spent: number): GiftProgressItem {
  const required = parseFloat(gift.requiredWagering);
  const isClaimed = gift.claimedBy.some((claim) => claim.userId === userId);
  return {
    id: gift.id,
    name: gift.name,
    image: gift.image,
    requiredWagering: gift.requiredWagering,
    rewardType: gift.rewardType,
    rewardValue: gift.rewardValue,
    isClaimed,
    isEligible: spent >= required && !isClaimed,
    progress: required > 0 ? Math.min(100, Math.round((spent / required) * 100)) : 100,
  };
}
