"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { removeFromCart, updateCartQty } from "@/lib/buyer/cart-actions";

export function CartLineControls({
  cartItemId,
  quantity,
}: {
  cartItemId: string;
  quantity: number;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function run(formData: FormData, action: typeof updateCartQty) {
    setPending(true);
    setError("");
    const result = await action({ ok: true, message: "" }, formData);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  function withItem(formData?: FormData): FormData {
    const fd = formData ?? new FormData();
    fd.set("cartItemId", cartItemId);
    return fd;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Quantity"
          className="flex h-8 items-center rounded-md border border-input bg-card"
        >
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={pending}
            onClick={() => {
              const fd = withItem();
              fd.set("quantity", String(quantity - 1));
              void run(fd, updateCartQty);
            }}
            className="flex h-full w-8 items-center justify-center font-semibold text-foreground/70 transition-colors hover:text-foreground disabled:opacity-40"
          >
            −
          </button>
          <span aria-live="polite" className="w-8 text-center text-sm font-bold tabular-nums">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={pending}
            onClick={() => {
              const fd = withItem();
              fd.set("quantity", String(quantity + 1));
              void run(fd, updateCartQty);
            }}
            className="flex h-full w-8 items-center justify-center font-semibold text-foreground/70 transition-colors hover:text-foreground disabled:opacity-40"
          >
            +
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label="Remove item"
          onClick={() => void run(withItem(), removeFromCart)}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
          Remove
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
