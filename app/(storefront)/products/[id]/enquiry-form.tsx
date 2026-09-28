"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createEnquiry, type BuyerActionState } from "@/lib/buyer/actions";

const initialState: BuyerActionState = { ok: false, message: "" };

export function EnquiryForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createEnquiry, initialState);

  if (state.ok) {
    router.push("/account?tab=enquiries");
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="lg" className="h-11 w-full text-base font-semibold" />
        }
      >
        Send Enquiry
      </DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Send Enquiry</DialogTitle>
          <DialogDescription>
            Tell the supplier what you need. They will respond with a quote.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="productId" value={productId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="quantity">Quantity (optional)</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              placeholder="Enter quantity"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="message">Message (optional)</Label>
            <textarea
              id="message"
              name="message"
              rows={4}
              maxLength={2000}
              placeholder="Describe your requirements..."
              className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {state.message && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Sending..." : "Send Enquiry"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
