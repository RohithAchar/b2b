import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { isProductSaved } from "@/lib/buyer/queries";
import { recordRecentlyViewed } from "@/lib/buyer/actions";
import { SaveButton } from "./save-button";
import { AddToCartForm } from "./add-to-cart-form";

export type IslandVariant = {
  id: string;
  label: string;
  customer_price: number | undefined;
  moq: number | null;
};

/**
 * Personalized buy box. Auth + saved-state + recently-viewed all live here
 * so the cached product body (gallery, price, specs, tabs) paints without
 * waiting for per-user lookups.
 */
export async function ProductActionsIsland({
  productId,
  moq,
  unit,
  variants,
}: {
  productId: string;
  moq: number;
  unit: string;
  variants: IslandVariant[];
}) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  const saved = user ? await isProductSaved(supabase, user.id, productId) : false;

  // Per-user write — never block the cached PDP body on it. Runs after the
  // response starts streaming; failures only log.
  if (user) {
    void recordRecentlyViewed(productId);
  }

  return (
    <div className="flex flex-col gap-2">
      <AddToCartForm
        productId={productId}
        moq={moq}
        unit={unit}
        variants={variants}
        signedIn={!!user}
      />
      <div className="grid grid-cols-2 gap-2">
        <SaveButton productId={productId} saved={saved} />
      </div>
    </div>
  );
}
