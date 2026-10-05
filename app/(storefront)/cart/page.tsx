import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCartSummary } from "@/lib/buyer/cart-actions";
import { MIN_CART_VALUE, formatRupees } from "@/lib/buyer/cart";
import { publicImageUrl } from "@/lib/storage";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { CartLineControls } from "./cart-line-controls";

export const metadata: Metadata = {
  title: "My Cart",
  description: "Review your cart. Checkout unlocks at a ₹2,500 subtotal.",
};

export default async function CartPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect("/auth/login?next=/cart");
  }

  const summary = await getCartSummary(supabase, user.id);
  const progress = Math.min(100, Math.round((summary.subtotal / MIN_CART_VALUE) * 100));

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
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-3">
            {summary.unavailableCount > 0 && (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {summary.unavailableCount} item{summary.unavailableCount > 1 ? "s were" : " was"} removed
                because {summary.unavailableCount > 1 ? "they are" : "it is"} no longer available.
              </p>
            )}
            {summary.lines.map((line) => (
              <Card key={line.cartItemId} className="rounded-lg p-4">
                <div className="flex gap-3">
                  <Link
                    href={`/products/${line.productId}`}
                    aria-label={`View ${line.title}`}
                    className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                  >
                    {line.imagePath ? (
                      <Image
                        src={publicImageUrl("product_images", line.imagePath)}
                        alt={line.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${line.productId}`}
                      className="block truncate text-sm font-semibold hover:text-primary"
                    >
                      {line.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRupees(line.unitPrice)} / {line.unit} · MOQ: {line.moq}
                    </p>
                    {line.quantity > line.stockQty && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Only {line.stockQty} in stock
                      </p>
                    )}
                    {line.quantity < line.moq && (
                      <p className="mt-0.5 text-xs font-medium text-warning">
                        Minimum order is {line.moq} {line.unit} — increase the quantity.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <CartLineControls cartItemId={line.cartItemId} quantity={line.quantity} moq={line.moq} />
                      <p className="text-sm font-bold tabular-nums">
                        {formatRupees(line.lineTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="h-fit rounded-lg p-4 lg:sticky lg:top-32">
            <p className="text-sm font-semibold">Order summary</p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold tabular-nums">{formatRupees(summary.subtotal)}</span>
            </div>
            <div className="mt-3">
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to minimum cart value"
                className="h-2 overflow-hidden rounded-sm bg-muted"
              >
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              {summary.meetsMinimum ? (
                <p className="mt-2 text-xs font-medium text-success">
                  Minimum met — you can check out.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Add {formatRupees(summary.shortfall)} more to reach the{" "}
                  {formatRupees(MIN_CART_VALUE)} minimum.
                </p>
              )}
            </div>
            <Button disabled={!summary.meetsMinimum} className="mt-4 w-full" title="Checkout coming soon">
              {summary.meetsMinimum ? "Checkout (coming soon)" : `Checkout · min ${formatRupees(MIN_CART_VALUE)}`}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Prices include applicable slabs and are confirmed at checkout.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
