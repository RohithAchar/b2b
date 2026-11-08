"use client";

import { useActionState, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { EyeOffIcon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { unpublishProduct } from "@/lib/admin/products";
import type { AdminActionState } from "@/lib/admin/actions";

const initial: AdminActionState = { ok: false, message: "" };

export function ProductDecisionForm({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(
    unpublishProduct,
    initial,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const unpublishFormRef = useRef<HTMLFormElement>(null);

  if (status !== "approved") return null;

  return (
    <div className="flex flex-col gap-3">
      {unpublishState.message ? (
        <Alert variant={unpublishState.ok ? "default" : "destructive"}>
          <AlertTitle>{unpublishState.ok ? "Done" : "Could not take down"}</AlertTitle>
          <AlertDescription>{unpublishState.message}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button variant="destructive" disabled={unpublishPending} onClick={() => setConfirmOpen(true)}>
          <HugeiconsIcon icon={EyeOffIcon} strokeWidth={2} />
          {unpublishPending ? "Taking down…" : "Take down"}
        </Button>
      </div>
      <form ref={unpublishFormRef} action={unpublishAction}>
        <input type="hidden" name="id" value={productId} />
      </form>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={EyeOffIcon} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>Take down this product?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the storefront immediately. The supplier can
              edit it and resubmit to relist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                unpublishFormRef.current?.requestSubmit();
              }}
            >
              Take down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}