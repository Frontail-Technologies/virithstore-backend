export interface GiftProgressItem {
  id: string;
  name: string;
  image: string | null;
  requiredWagering: string;
  rewardType: "discount" | "product" | "cash";
  rewardValue: string;
  isClaimed: boolean;
  isEligible: boolean;
  progress: number;
}

export interface GiftProgressResponse {
  totalSpent: string;
  gifts: GiftProgressItem[];
}
