import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCartCoupons, getCartSummary } from "@/lib/buyer/cart-actions";
import { groupCartLinesBySupplier } from "@/lib/buyer/cart";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { CartGroups } from "./cart-groups";

export const metadata: Metadata = {
  title: "My Cart",
  description: "Review your cart. Checkout unlocks at a ₹2,500 subtotal.",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect("/auth/login?next=/cart");
  }

  // Summary and saved coupons are independent reads.
  const [summary, savedCoupons] = await Promise.all([
    getCartSummary(supabase, user.id),
    // Table may not exist until the cart_coupons migration is applied; a
    // missing table degrades to no saved codes rather than a broken cart.
    getCartCoupons(supabase, user.id).catch((error) => {
      console.error("Cart coupons lookup failed:", error);
      return {} as Record<string, string>;
    }),
  ]);
  const groups = groupCartLinesBySupplier(summary.lines);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My Cart" }]} />
      <h1 className="mt-2 text-xl font-bold tracking-tight md:text-2xl">My Cart</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary.itemCount === 0
          ? "Nothing here yet."
          : `${summary.itemCount} item${summary.itemCount > 1 ? "s" : ""} from your saved picks.`}
      </p>

      {summary.lines.length === 0 ? (
        <Card className="mt-4 rounded-lg p-6">
          <Empty>
            <EmptyTitle>Your cart is empty</EmptyTitle>
            <EmptyDescription>
              Browse the catalog and add products to get started.
            </EmptyDescription>
            <Link href="/products" className="mt-4">
              <Button>Browse products</Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <CartGroups
          groups={groups}
          savedCoupons={savedCoupons}
          subtotal={summary.subtotal}
          meetsMinimum={summary.meetsMinimum}
          shortfall={summary.shortfall}
          unavailableCount={summary.unavailableCount}
        />
      )}
    </div>
  );
}
