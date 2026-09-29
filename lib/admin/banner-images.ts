import { SLOT_ASPECTS, type BannerSlot } from "./banner-slots";

export const BANNER_OUTPUT_WIDTH = 1600;

/**
 * Canonical stored dimensions per slot. Uploads are normalized to this on the
 * server so what is in storage always fills the storefront slot exactly.
 */
export function getBannerOutputSize(slot: BannerSlot) {
  const width = BANNER_OUTPUT_WIDTH;
  const height = Math.round(width / SLOT_ASPECTS[slot]);

  return {
    width,
    height,
  };
}
