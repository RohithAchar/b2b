import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getBuyerAddresses } from "@/lib/buyer/address-queries";
import { getCheckoutPreview } from "@/lib/buyer/checkout-queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your order and confirm your delivery address.",
};

export default async function CheckoutPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect("/auth/login?next=/checkout");
  }

  const [preview, addresses] = await Promise.all([
    getCheckoutPreview(supabase, user.id),
    getBuyerAddresses(supabase, user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "My Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
      />
      <h1 className="mt-2 text-xl font-bold tracking-tight md:text-2xl">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One order is created for each supplier in your cart.
      </p>

      {preview.groups.length === 0 ? (
        <Card className="mt-4 rounded-lg p-6">
          <Empty>
            <EmptyTitle>Nothing to check out</EmptyTitle>
            <EmptyDescription>
              Your cart is empty or has no available products right now.
            </EmptyDescription>
            <Link href="/cart" className="mt-4">
              <Button>Back to cart</Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <div className="mt-4">
          <CheckoutClient preview={preview} addresses={addresses} />
        </div>
      )}
    </div>
  );
}
