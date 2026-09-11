"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
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

  return (
    <>
      {status === "draft" || status === "rejected" ? (
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
          Submit
        </Button>
      ) : null}
      {status === "draft" || status === "rejected" ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (confirm("Delete this product?")) {
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
              }
            })
          }
        >
          Delete
        </Button>
      ) : null}
    </>
  );
}
