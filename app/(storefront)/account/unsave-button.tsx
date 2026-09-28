"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { unsaveProduct } from "@/lib/buyer/actions";

export function UnsaveButton({ productId, title }: { productId: string; title: string }) {
  const router = useRouter();

  return (
    <form
      action={async (formData: FormData) => {
        await unsaveProduct({ ok: true, message: "" }, formData);
        router.refresh();
      }}
      className="absolute top-2 right-2"
    >
      <input type="hidden" name="productId" value={productId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-7 rounded-sm bg-card/90 text-xs shadow-sm"
        aria-label={`Remove ${title} from saved`}
      >
        Remove
      </Button>
    </form>
  );
}
