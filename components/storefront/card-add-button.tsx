"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { addToCart, type BuyerActionState } from "@/lib/buyer/cart-actions";

const initialState: BuyerActionState = { ok: false, message: "" };

/**
 * One-tap add from listing cards: base product at its MOQ. Full
 * variant/quantity control lives on the product page.
 */
export function CardAddButton({ productId, moq }: { productId: string; moq: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addToCart, initialState);

  useEffect(() => {
    if (state.ok) {
      toast.add({ type: "success", title: "Added to cart" });
      router.refresh();
    } else if (state.message) {
      toast.add({ type: "error", title: "Could not add to cart", description: state.message });
    }
  }, [state, router]);

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={Math.max(1, moq)} />
      <Button
        type="submit"
        variant="default"
        size="lg"
        disabled={pending}
        aria-busy={pending}
        className="h-11 w-full text-base font-semibold"
      >
        {pending ? (
          <Spinner className="size-4" />
        ) : (
          <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} data-icon="inline-start" />
        )}
        {pending ? "Adding..." : "Add to Cart"}
      </Button>
    </form>
  );
}
