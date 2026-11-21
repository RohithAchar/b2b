"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, WhatsappIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Opens once when the buyer lands on the order confirmation page: the order
 * is placed and the D2B team will be in touch. When a support WhatsApp number
 * is configured (NEXT_PUBLIC_SUPPORT_WHATSAPP), the buyer can message the team
 * straight away with the order reference pre-filled.
 */
export function OrderPlacedDialog({
  references,
  whatsappHref,
}: {
  references: string[]
  whatsappHref: string | null
}) {
  const [open, setOpen] = useState(true)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success [&_svg]:size-7">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
          </span>
          <DialogTitle className="text-lg">Your order is placed</DialogTitle>
          <DialogDescription>
            Our team will contact you soon.
            {references.length > 0 ? (
              <>
                {" "}
                Order {references.length === 1 ? "reference" : "references"}:{" "}
                <span className="font-semibold text-foreground tabular-nums">{references.join(", ")}</span>
              </>
            ) : null}
          </DialogDescription>
          <div className="mt-1 flex w-full flex-col gap-2">
            {whatsappHref ? (
              <Button
                render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
                className="w-full"
              >
                <HugeiconsIcon icon={WhatsappIcon} strokeWidth={2} data-icon="inline-start" />
                Chat with us on WhatsApp
              </Button>
            ) : null}
            <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
