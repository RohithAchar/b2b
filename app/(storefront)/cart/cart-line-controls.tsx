"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { removeFromCart, updateCartQty } from "@/lib/buyer/cart-actions";
import { parseQuantityInput } from "@/lib/buyer/cart";

// Rapid +/- clicks coalesce into one server round-trip, so the quantity on
// screen is never waiting on a network hop to move.
const COMMIT_DELAY_MS = 400;

export function CartLineControls({
  cartItemId,
  quantity,
  moq,
}: {
  cartItemId: string;
  quantity: number;
  moq: number;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  // The stepper never goes below the line's MOQ; only Remove deletes a line.
  const floor = Math.max(1, moq);
  // Displayed value: optimistic while stepping or typing, reconciled with the
  // server truth below once a refresh lands.
  const [draft, setDraft] = useState(String(quantity));
  const [busy, setBusy] = useState(false);

  const timerRef = useRef<number | null>(null);
  const targetRef = useRef<number>(quantity);
  const inFlightRef = useRef(false);
  const refireRef = useRef(false);

  // Reconcile with the server truth after each commit. This adjusts state
  // during render rather than in an effect, so a refresh can never paint a
  // stale quantity (the bug where only the price appeared to update).
  const [prevQuantity, setPrevQuantity] = useState(quantity);
  if (prevQuantity !== quantity) {
    setPrevQuantity(quantity);
    setDraft(String(quantity));
  }

  // Never leave a debounce timer behind on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function commit(value: number) {
    const fd = new FormData();
    fd.set("cartItemId", cartItemId);
    fd.set("quantity", String(value));
    inFlightRef.current = true;
    setBusy(true);
    setError("");
    void updateCartQty({ ok: true, message: "" }, fd)
      .then((result) => {
        if (!result.ok) {
          setError(result.message);
          // Drop back to the last quantity the server actually holds.
          setDraft(String(quantity));
          targetRef.current = quantity;
          return;
        }
        router.refresh();
      })
      .finally(() => {
        inFlightRef.current = false;
        setBusy(false);
        // A click landed mid-flight: commit the newest target so rapid
        // stepping converges on the value shown on screen, never a stale one.
        if (refireRef.current) {
          refireRef.current = false;
          if (targetRef.current !== value) commit(targetRef.current);
        }
      });
  }

  function schedule(value: number) {
    targetRef.current = value;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (inFlightRef.current) {
        refireRef.current = true;
        return;
      }
      commit(targetRef.current);
    }, COMMIT_DELAY_MS);
  }

  function step(delta: number) {
    const current = parseQuantityInput(draft, floor) ?? floor;
    const next = current + delta;
    if (next < floor) return;
    setDraft(String(next));
    setError("");
    schedule(next);
  }

  function commitDraft() {
    const next = parseQuantityInput(draft, floor);
    if (next == null) {
      setDraft(String(quantity));
      return;
    }
    if (next === quantity) return;
    // A typed value is explicit intent — commit immediately, no debounce.
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDraft(String(next));
    schedule(next);
  }

  function remove() {
    // Cancel any pending debounce so we never write a quantity to a deleted line.
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const fd = new FormData();
    fd.set("cartItemId", cartItemId);
    setBusy(true);
    setError("");
    void removeFromCart({ ok: true, message: "" }, fd).then((result) => {
      if (!result.ok) {
        setError(result.message);
        setBusy(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <InputGroup className="w-auto">
          <InputGroupAddon align="inline-start">
            <InputGroupButton
              aria-label="Decrease quantity"
              disabled={busy || (parseQuantityInput(draft, floor) ?? floor) <= floor}
              onClick={() => step(-1)}
            >
              −
            </InputGroupButton>
          </InputGroupAddon>
          <span aria-live="polite" className="sr-only">
            {busy ? "Updating quantity" : `Quantity ${draft}`}
          </span>
          <InputGroupInput
            aria-label="Quantity"
            inputMode="numeric"
            autoComplete="off"
            disabled={busy}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-10 text-center font-bold tabular-nums"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label="Increase quantity"
              disabled={busy}
              onClick={() => step(1)}
            >
              +
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          aria-label="Remove item"
          onClick={remove}
        >
          {busy ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
          )}
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
