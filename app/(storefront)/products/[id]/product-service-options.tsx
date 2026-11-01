import { HugeiconsIcon } from "@hugeicons/react"
import {
  BoxIcon,
  ContainerTruckIcon,
  FlashIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "cn"

const tileClass =
  "flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm font-semibold"

/**
 * Service strip. FBD and DDP are display-only labels (the marketplace has no
 * per-option configuration yet); WhatsApp is a real share/contact deep link.
 */
export function ProductServiceOptions({ whatsappHref }: { whatsappHref: string }) {
  return (
    <section aria-labelledby="service-options-heading">
      <h2
        id="service-options-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Service &amp; Delivery
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={tileClass}>
          <HugeiconsIcon
            icon={BoxIcon}
            strokeWidth={2}
            className="size-4 shrink-0 text-muted-foreground"
          />
          FBD
        </div>
        <div className={tileClass}>
          <HugeiconsIcon
            icon={ContainerTruckIcon}
            strokeWidth={2}
            className="size-4 shrink-0 text-muted-foreground"
          />
          DDP
        </div>
        <div className={tileClass}>
          <HugeiconsIcon
            icon={FlashIcon}
            strokeWidth={2}
            className="size-4 shrink-0 text-muted-foreground"
          />
          Fast Delivery
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className={cn(
            tileClass,
            "press border-success/30 bg-success/5 text-success outline-none hover:bg-success/10 focus-visible:ring-[3px] focus-visible:ring-ring/50",
          )}
        >
          <HugeiconsIcon icon={WhatsappIcon} strokeWidth={2} className="size-4 shrink-0" />
          WhatsApp Now
        </a>
      </div>
    </section>
  )
}
