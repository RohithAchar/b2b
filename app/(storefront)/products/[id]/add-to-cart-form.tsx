"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { addToCart, type BuyerActionState } from "@/lib/buyer/cart-actions";
import { parseQuantityInput } from "@/lib/buyer/cart";
import { useVariantSelection } from "./variant-selection";

const initialState: BuyerActionState = { ok: false, message: "" };

export type AddToCartVariant = {
  id: string;
  label: string;
  customer_price: number | undefined;
  moq: number | null;
};

export function AddToCartForm({
  productId,
  moq,
  unit,
  variants,
  signedIn,
}: {
  productId: string;
  moq: number;
  unit: string;
  variants: AddToCartVariant[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hideBottomNav = /^\/products\/[^/]+$/.test(pathname ?? "");
  const [state, action, pending] = useActionState(addToCart, initialState);
  // Chosen with the chips in the price panel (shared context).
  const { variantId } = useVariantSelection();
  const initialMoq = Math.max(1, variants[0]?.moq ?? moq);
  const [quantity, setQuantity] = useState(initialMoq);
  // Typed text mirrors the committed quantity; it only becomes the quantity
  // on blur/Enter so intermediate states ("", "1" while typing "12") are safe.
  const [draft, setDraft] = useState(String(initialMoq));

  const selected = variants.find((v) => v.id === variantId);
  const effectiveMoq = Math.max(1, selected?.moq ?? moq);
  const formId = `add-to-cart-form-${productId}`;
  const loginHref = `/auth/login?next=/products/${productId}&reason=purchase`;

  function setBoth(next: number) {
    setQuantity(next);
    setDraft(String(next));
  }

  // Clamp up when the chosen variant has a higher MOQ (adjusting state during
  // render on a prop change, React's documented pattern). Never clamps down.
  const [seenVariant, setSeenVariant] = useState(variantId);
  if (seenVariant !== variantId) {
    setSeenVariant(variantId);
    if (quantity < effectiveMoq) setBoth(effectiveMoq);
  }

  function commitDraft() {
    const next = parseQuantityInput(draft, effectiveMoq);
    setBoth(next ?? quantity);
  }

  useEffect(() => {
    if (state.ok) {
      toast.add({ type: "success", title: "Added to cart" });
      router.refresh();
    }
  }, [state.ok, router]);

  const stickyBar = (
    <div
      className={`fixed inset-x-0 z-30 bg-card lg:hidden overflow-hidden before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border before:content-[''] ${
        hideBottomNav
          ? "bottom-0 pb-(--safe-area-bottom)"
          : "bottom-(--bottom-nav-offset)"
      }`}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2.5">
        <Button
          variant="outline"
          size="lg"
          className="h-11 flex-1 text-base font-semibold"
          nativeButton={false}
          render={<Link href="/cart" />}
        >
          <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} className="size-5" />
          View Cart
        </Button>
        {signedIn ? (
          <Button
            type="submit"
            form={formId}
            size="lg"
            disabled={pending}
            className="h-11 flex-[1.6] text-base font-semibold"
          >
            <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} className="size-5" />
            {pending ? "Adding..." : "Add to Cart"}
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-11 flex-[1.6] text-base font-semibold"
            nativeButton={false}
            render={<Link href={loginHref} />}
          >
            <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} className="size-5" />
            Add to Cart
          </Button>
        )}
      </div>
    </div>
  );

  if (!signedIn) {
    return (
      <>
        <Link href={loginHref} className="hidden lg:block">
          <Button size="lg" className="h-11 w-full text-base font-semibold">
            <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} className="size-5" />
            Add to Cart
          </Button>
        </Link>
        {stickyBar}
      </>
    );
  }

  return (
    <>
      <form id={formId} action={action} className="flex flex-col gap-2">
        <input type="hidden" name="productId" value={productId} />
        {variantId !== "base" && <input type="hidden" name="variantId" value={variantId} />}
        <input type="hidden" name="quantity" value={quantity} />


        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Quantity"
            className="flex h-11 items-center rounded-md border border-input bg-card"
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= effectiveMoq || pending}
              onClick={() => setBoth(Math.max(effectiveMoq, quantity - 1))}
              className="flex h-full w-10 items-center justify-center text-lg font-semibold text-foreground/70 transition-colors hover:text-foreground disabled:opacity-40"
            >
              −
            </button>
            <input
              aria-label="Quantity"
              inputMode="numeric"
              autoComplete="off"
              disabled={pending}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                // Commit on Enter without submitting: the blur handler parses
                // first, and submitting here could read the pre-commit value.
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-40"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={pending}
              onClick={() => setBoth(quantity + 1)}
              className="flex h-full w-10 items-center justify-center text-lg font-semibold text-foreground/70 transition-colors hover:text-foreground disabled:opacity-40"
            >
              +
            </button>
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="hidden h-11 flex-1 text-base font-semibold lg:inline-flex"
          >
            <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} className="size-5" />
            {pending ? "Adding..." : "Add to Cart"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          MOQ: {effectiveMoq} {unit}
          {effectiveMoq > 1 ? "s" : ""} · Minimum cart value ₹2,500
        </p>
        {state.message && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
      </form>
      {stickyBar}
    </>
  );
}
