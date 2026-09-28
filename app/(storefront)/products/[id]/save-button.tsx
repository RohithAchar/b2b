"use client";

import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { HeartIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { saveProduct, unsaveProduct } from "@/lib/buyer/actions";

export function SaveButton({
  productId,
  saved,
}: {
  productId: string;
  saved: boolean;
}) {
  const router = useRouter();

  if (saved) {
    return (
      <form
        action={async (formData: FormData) => {
          await unsaveProduct({ ok: true, message: "" }, formData);
          router.refresh();
        }}
      >
        <input type="hidden" name="productId" value={productId} />
        <Button
          type="submit"
          variant="outline"
          className="w-full border-border bg-card"
        >
          <HugeiconsIcon icon={HeartIcon} strokeWidth={2} className="size-4 text-primary" />
          Saved
        </Button>
      </form>
    );
  }

  return (
    <form
      action={async (formData: FormData) => {
        await saveProduct({ ok: true, message: "" }, formData);
        router.refresh();
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <Button
        type="submit"
        variant="outline"
        className="w-full border-border bg-card"
      >
        <HugeiconsIcon icon={HeartIcon} strokeWidth={2} className="size-4" />
        Save
      </Button>
    </form>
  );
}
