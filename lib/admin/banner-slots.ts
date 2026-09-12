export const BANNER_SLOTS = ["hero", "promo"] as const;
export type BannerSlot = (typeof BANNER_SLOTS)[number];

export const SLOT_LABELS: Record<BannerSlot, string> = {
  hero: "Hero carousel",
  promo: "Promotional strip",
};