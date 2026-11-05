import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

const QUICK_ACTIONS = [9, 49, 99, 199] as const

/**
 * Homepage banner + price shortcuts.
 *
 * The banner is a deliberate placeholder until campaign artwork is uploaded;
 * the four shortcuts are real catalogue price filters (`maxPrice`).
 */
export function HomeBannerActions() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <div className="flex gap-2.5">
        <div className="relative w-2/5 shrink-0 overflow-hidden rounded-xl border border-brand-200 bg-brand-50 p-3 sm:p-5">
          <div
            aria-hidden="true"
            className="absolute -top-6 -right-6 size-20 rounded-full bg-brand-100/70"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-8 -left-5 size-24 rounded-full bg-brand-100/60"
          />
          <div className="relative flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              D
            </span>
            <p className="text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
              Banner
            </p>
            <p className="max-w-28 text-[11px] leading-snug text-muted-foreground">
              Artwork coming soon
            </p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-2.5">
          {QUICK_ACTIONS.map((amount) => (
            <Link
              key={amount}
              href={`/products?maxPrice=${amount}`}
              className="press group relative flex min-h-24 flex-col justify-center rounded-xl border border-brand-200 bg-card px-3 py-3 text-center hover:border-brand-300 hover:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:min-h-28"
            >
              <HugeiconsIcon
                icon={Add01Icon}
                strokeWidth={2}
                aria-hidden="true"
                className="absolute top-2 right-2 size-3.5 text-brand-400 transition-colors group-hover:text-brand-600"
              />
              <span className="text-[11px] font-medium text-brand-700 sm:text-xs">
                Shop under
              </span>
              <span className="mt-0.5 text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
                ₹{amount}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
