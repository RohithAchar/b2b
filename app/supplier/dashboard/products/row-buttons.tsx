"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
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

  if (!verified) return null;

  return (
    <>
      {status === "draft" || status === "rejected" ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await submitProduct(productId);
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
              if (confirm("Delete this product?")) await deleteProduct(productId);
            })
          }
        >
          Delete
        </Button>
      ) : null}
    </>
  );
}
