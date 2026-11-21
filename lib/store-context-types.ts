/** Cookie used to persist a customer's store selection across the storefront. */
export const STORE_COOKIE_NAME = "d2b_store";

export type ActiveStore = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

/**
 * Stores whose supplier dashboard is open. Every other store (D2H Select,
 * Ecom Package, Dropship) shows "(soon)" in the store switcher and opens the
 * coming-soon page; the storefront tabs mark the same stores "Soon".
 */
export const DASHBOARD_READY_STORES = ["d2h-core"] as const;

export function isDashboardReady(slug: string): boolean {
  return (DASHBOARD_READY_STORES as readonly string[]).includes(slug);
}
