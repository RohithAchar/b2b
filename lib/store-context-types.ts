/** Cookie used to persist a customer's store selection across the storefront. */
export const STORE_COOKIE_NAME = "d2b_store";

export type ActiveStore = {
  id: string;
  name: string;
  slug: string;
  status: string;
};
