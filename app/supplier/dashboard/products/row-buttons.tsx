"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, SendIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { deleteProduct, submitProduct } from "@/lib/supplier/product-actions";

export function ProductRowButtons({
  productId,
  status,
  verified,
}: {
  productId: string;
  status: string;
  verified: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!verified) return null;

  const editable = status === "draft" || status === "rejected";

  return (
    <>
      {status === "approved" ? (
        <Button
          render={<Link href={`/products/${productId}`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
        >
          View
        </Button>
      ) : null}
      {editable ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await submitProduct(productId);
              if (result.ok) {
                toast.add({
                  type: "success",
                  title: "Submitted",
                  description: result.message,
                });
                router.refresh();
              } else {
                toast.add({
                  type: "error",
                  title: "Could not submit",
                  description: result.message,
                });
              }
            })
          }
        >
          <HugeiconsIcon icon={SendIcon} strokeWidth={2} />
          Submit
        </Button>
      ) : null}
      {editable ? (
        <ConfirmDialog
          title="Delete this product?"
          description="This removes the listing and its images permanently. This cannot be undone."
          confirmLabel="Delete"
          trigger={
            <Button variant="destructive" size="sm" disabled={pending}>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              Delete
            </Button>
          }
          onConfirm={() =>
            start(async () => {
              const result = await deleteProduct(productId);
              if (result.ok) {
                router.refresh();
              } else {
                toast.add({
                  type: "error",
                  title: "Could not delete",
                  description: result.message,
                });
              }
            })
          }
        />
      ) : null}
    </>
  );
}