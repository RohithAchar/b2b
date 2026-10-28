import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

// Structural skeletons that mirror their real layouts (same grids, spacing and
// aspect ratios) so loading reserves the exact space the content will occupy,
// avoiding layout shift. All ephemeral, non-interactive placeholder markup —
// never focusable, not announced by screen readers.

export function ProductCardSkeleton() {
  return (
    <Card className="!gap-0 overflow-hidden border-border !py-0">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <div className="flex flex-col gap-1 px-2.5 py-2.5">
        <div className="min-h-10 space-y-1">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-16 rounded-sm" />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-2.5 py-2 !pt-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-3 w-24 max-w-full" />
          <Skeleton className="h-2.5 w-20 max-w-full" />
        </div>
        <Skeleton className="size-10 shrink-0 rounded-md" />
      </div>
    </Card>
  )
}

export function ProductGridSkeleton({
  count = 24,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={
        className ??
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      }
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function CatalogueSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card lg:block">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex flex-col gap-3 p-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-5" />
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-28 max-w-full" />
                  <Skeleton className="h-3 w-4" />
                </div>
              ))}
            </div>
          </div>
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-px w-full" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="mt-3 h-3 w-full rounded-full" />
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {Array.from({ length: 4 }, (_, j) => (
                    <Skeleton key={j} className="h-7 w-full rounded-sm" />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            </div>
          ))}
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-44" />
        </div>
        <ProductGridSkeleton
          count={count}
          className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-5 min-[1200px]:grid-cols-6"
        />
      </div>
    </div>
  )
}

export function CategoryTileSkeleton() {
  return (
    <Card className="gap-1 overflow-hidden border-border !py-0">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <div className="px-2.5 py-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-1.5 h-3 w-1/2" />
      </div>
    </Card>
  )
}

export function CategoryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-hidden
      className="-mx-4 no-scrollbar flex scroll-pl-4 gap-3 overflow-hidden px-4 md:mx-0 md:grid md:scroll-pl-0 md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-8"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="w-[40vw] min-w-[132px] flex-none md:w-auto md:min-w-0"
        >
          <CategoryTileSkeleton />
        </div>
      ))}
    </div>
  )
}

/**
 * `/categories` tile grid. Mirrors the real card (image, name, count, chips)
 * and the responsive column counts so the loading boundary reserves the same
 * space the grid will occupy.
 */
export function CategoryPageGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      aria-hidden
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <Card
          key={index}
          className="!gap-0 overflow-hidden border-border !py-0 [--card-spacing:--spacing(3)]"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="flex flex-col gap-1 px-3 pt-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="mt-auto flex flex-wrap gap-1 px-3 pt-2.5 pb-3">
            <Skeleton className="h-6 w-20 rounded-sm" />
            <Skeleton className="h-6 w-24 rounded-sm" />
          </div>
        </Card>
      ))}
    </div>
  )
}

export function SupplierCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="size-10 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-sm" />
      </div>
      <div className="flex gap-1 p-2" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="relative aspect-square flex-1 overflow-hidden rounded-md bg-muted"
          >
            <Skeleton className="absolute inset-0 rounded-none" />
          </div>
        ))}
      </div>
      <div className="px-4 pt-1 pb-3">
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </Card>
  )
}

export function SupplierGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-hidden
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <SupplierCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function RegionCardSkeleton() {
  return (
    <Card className="h-full border-border p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="size-4 rounded-full" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-14 rounded-sm" />
        ))}
      </div>
    </Card>
  )
}

export function RegionGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      aria-hidden
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <RegionCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumbs row parity */}
      <div aria-hidden className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="size-3" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,576px)_minmax(380px,440px)] lg:gap-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="relative mx-auto aspect-square w-full max-w-[500px] overflow-hidden rounded-lg border border-border bg-card lg:mx-0">
            <Skeleton className="absolute inset-0 rounded-none" />
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 lg:order-first lg:w-16 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:pb-0">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="relative size-16 shrink-0 overflow-hidden rounded-md border-2 border-border bg-card"
              >
                <Skeleton className="absolute inset-0 rounded-none" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-8 w-1/2" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Skeleton className="h-14 rounded-md" />
              <Skeleton className="h-14 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-24 rounded-lg" />
          {/* Buy actions parity: add-to-cart + save/ship row */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full rounded-md" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 rounded-md" />
              <Skeleton className="h-4 self-center rounded-sm" />
            </div>
          </div>
          {/* Description / specifications / variants tabs parity */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-1.5">
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ListingShellSkeleton({
  titleWidth,
  subtitleWidth,
}: {
  titleWidth: string
  subtitleWidth: string
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-2">
      <div className="flex flex-col gap-2">
        <Skeleton className={`h-5 ${titleWidth}`} />
        <Skeleton className={`h-3 ${subtitleWidth}`} />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  )
}

export function AddressCardSkeleton() {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-sm" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </li>
  )
}

export function SearchHeroSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-3 sm:py-6">
      <div className="flex flex-col rounded-lg border border-border bg-card max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent">
        <div className="flex flex-col gap-2 px-4 pt-4 max-sm:px-0 max-sm:pt-0 sm:px-5 sm:pt-5">
          <Skeleton className="h-12 w-full rounded-md" />
          {/* Mobile popular-category chip row */}
          <div className="flex gap-2 overflow-hidden sm:hidden">
            <Skeleton className="h-10 w-32 shrink-0 rounded-md" />
            <Skeleton className="h-10 w-28 shrink-0 rounded-md" />
            <Skeleton className="h-10 w-36 shrink-0 rounded-md" />
          </div>
          {/* Tablet/desktop hot-search row */}
          <div className="hidden items-center gap-2 sm:flex">
            <Skeleton className="h-4 w-10 rounded-sm" />
            <Skeleton className="h-4 w-24 rounded-sm" />
            <Skeleton className="h-4 w-20 rounded-sm" />
            <Skeleton className="h-4 w-28 rounded-sm" />
          </div>
        </div>
        <div className="mt-4 hidden border-t border-border lg:grid lg:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-2 border-r border-border p-4">
            <Skeleton className="h-9 w-full rounded-sm" />
            <Skeleton className="h-9 w-full rounded-sm" />
            <Skeleton className="h-9 w-full rounded-sm" />
            <Skeleton className="h-9 w-full rounded-sm" />
            <Skeleton className="h-9 w-full rounded-sm" />
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrderListSkeleton({
  count = 5,
  header = true,
}: {
  count?: number
  header?: boolean
}) {
  return (
    <div
      aria-hidden
      className={
        header
          ? "mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5"
          : "flex flex-col gap-5"
      }
    >
      {header ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {["w-24", "w-28", "w-24", "w-24", "w-20"].map((width, i) => (
          <Skeleton key={i} className={`h-[30px] rounded-full ${width}`} />
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-6">
              <div className="flex flex-col items-end gap-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-5 w-20 rounded-sm" />
              <Skeleton className="hidden h-3.5 w-20 sm:block" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OrderDetailSkeleton() {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-sm" />
          <Skeleton className="h-5 w-20 rounded-sm" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="hidden items-start justify-between gap-2 md:flex">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-2.5 w-12" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 md:hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </header>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <Skeleton className="size-5 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </section>

      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3.5 w-56 max-w-full" />
        <Skeleton className="mt-3 h-8 w-28 rounded-md" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-28" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border p-3 last:border-b-0"
          >
            <Skeleton className="size-11 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 4 }, (_, row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3"
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-20 rounded-sm" />
        </div>
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  )
}

export function PaySkeleton() {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-5 w-28 rounded-sm" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-20 rounded-sm" />
        </div>
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="mt-1.5 h-3.5 w-3/4" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
        <div className="flex flex-col gap-4 p-4">
          <Skeleton className="h-8 w-40" />
          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
            <Skeleton className="size-[264px] max-w-full rounded-md" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-56 max-w-full" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-8 w-24 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CartSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 h-7 w-32" />
      <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          {Array.from({ length: 2 }, (_, group) => (
            <section key={group}>
              <div className="flex items-baseline justify-between gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="mt-2 flex flex-col gap-3">
                {Array.from({ length: 2 }, (_, line) => (
                  <div
                    key={line}
                    className="flex gap-3 rounded-lg border border-border bg-card p-4"
                  >
                    <Skeleton className="size-20 shrink-0 rounded-md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Skeleton className="h-9 w-32 rounded-md" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="mt-2 h-8 w-full max-w-xs rounded-md" />
            </section>
          ))}
        </div>

        <div className="flex h-fit flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:sticky lg:top-32">
          <Skeleton className="h-4 w-28" />
          <div className="mt-1 flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-1 h-2 w-full rounded-sm" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="mt-2 h-10 w-full rounded-md" />
          <Skeleton className="mx-auto h-2.5 w-40" />
        </div>
      </div>
    </div>
  )
}

export function CheckoutSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-6 h-7 w-36" />
      <Skeleton className="mt-1.5 h-4 w-64 max-w-full" />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-sm" />
              </div>
              {Array.from({ length: 2 }, (_, line) => (
                <div
                  key={line}
                  className="flex items-center justify-between gap-3"
                >
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
              <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
            <div className="mt-1 flex flex-col gap-2">
              {Array.from({ length: 2 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <Skeleton className="mt-0.5 size-4 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 lg:shrink-0">
          <div className="flex h-fit flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:sticky lg:top-32">
            <Skeleton className="h-4 w-28" />
            <div className="mt-1 flex flex-col gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3"
                >
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-2 h-4 w-20" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AccountSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
      <Skeleton className="mt-5 h-9 w-96 max-w-full rounded-md" />
      <div className="mt-4 flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <ProductGridSkeleton
          count={10}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        />
        <Skeleton className="mx-auto h-9 w-56 rounded-md" />
      </div>
    </div>
  )
}

export function AccountTabSkeleton() {
  return (
    <div aria-hidden className="mt-4 flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />
      <ProductGridSkeleton
        count={10}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      />
    </div>
  )
}

export function StorePageSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-4 w-48" />
      <div className="mt-4 flex items-center gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <Skeleton className="size-14 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-56 max-w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-sm" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-6 mb-3 h-5 w-40" />
      <ProductGridSkeleton />
    </div>
  )
}

export function OrderSuccessSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-3xl px-4 py-8">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-1.5 h-4 w-80 max-w-full" />
      <div className="mt-5 flex flex-col gap-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="mt-1 h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-32 rounded-lg" />
      <div className="mt-6 flex flex-wrap gap-3">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
    </div>
  )
}

export function AddressListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <ul className="flex flex-col gap-3">
        {Array.from({ length: count }, (_, i) => (
          <AddressCardSkeleton key={i} />
        ))}
      </ul>
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}
