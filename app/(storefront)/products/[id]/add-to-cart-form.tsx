"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { addToCart, type BuyerActionState } from "@/lib/buyer/cart-actions";
import { parseQuantityInput } from "@/lib/buyer/cart";

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
  const [state, action, pending] = useActionState(addToCart, initialState);
  const [variantId, setVariantId] = useState("base");
  const [quantity, setQuantity] = useState(moq);
  // Typed text mirrors the committed quantity; it only becomes the quantity
  // on blur/Enter so intermediate states ("", "1" while typing "12") are safe.
  const [draft, setDraft] = useState(String(moq));

  const selected = variants.find((v) => v.id === variantId);
  const effectiveMoq = Math.max(1, selected?.moq ?? moq);

  function setBoth(next: number) {
    setQuantity(next);
    setDraft(String(next));
  }

  // Clamp up when switching to a variant with a higher MOQ. Never clamps
  // down: the buyer's chosen quantity stands unless the floor requires more.
  function handleVariantChange(next: string | null) {
    if (!next) return;
    setVariantId(next);
    const floor = Math.max(1, variants.find((v) => v.id === next)?.moq ?? moq);
    setBoth(Math.max(quantity, floor));
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

  if (!signedIn) {
    return (
      <Link href={`/auth/login?next=/products/${productId}`} className="block">
        <Button size="lg" className="h-11 w-full text-base font-semibold">
          <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} className="size-5" />
          Add to Cart
        </Button>
      </Link>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="productId" value={productId} />
      {variantId !== "base" && <input type="hidden" name="variantId" value={variantId} />}
      <input type="hidden" name="quantity" value={quantity} />

      {variants.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Variant</Label>
          <Select value={variantId} onValueChange={handleVariantChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Base product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base product</SelectItem>
              {variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                  {v.customer_price != null &&
                    ` — ₹${v.customer_price.toLocaleString("en-IN")}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
          className="h-11 flex-1 text-base font-semibold"
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
  );
}
