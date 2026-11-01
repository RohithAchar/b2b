import Image from "next/image"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Building02Icon,
  Location01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { publicImageUrl } from "@/lib/storage"
import { Button } from "@/components/ui/button"

export type StoreCardSupplier = {
  id: string
  business_name: string
  city: string | null
  state: string | null
  logo_path: string | null
}

export function ProductStoreCard({ supplier }: { supplier: StoreCardSupplier }) {
  const location = [supplier.city, supplier.state].filter(Boolean).join(", ")

  return (
    <section aria-labelledby="store-information-heading">
      <h2
        id="store-information-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Store Information
      </h2>
      <div className="mt-2 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          {supplier.logo_path ? (
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              <Image
                src={publicImageUrl("company_logos", supplier.logo_path)}
                alt={supplier.business_name}
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-5">
              <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{supplier.business_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-1.5 py-0.5 font-semibold text-success">
                <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} className="size-3" />
                Verified supplier
              </span>
              {location ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <HugeiconsIcon
                    icon={Location01Icon}
                    strokeWidth={2}
                    className="size-3 shrink-0"
                  />
                  <span className="truncate">{location}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-3 h-9 w-full"
          nativeButton={false}
          render={<Link href={`/store/${supplier.id}`} />}
        >
          View More Information
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
        </Button>
      </div>
    </section>
  )
}
