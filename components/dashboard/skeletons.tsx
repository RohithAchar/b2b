import { Skeleton } from "@/components/ui/skeleton"

// Structural placeholders for dashboard/admin pages. Each mirrors the real
// layout (headers, KPI cards, tables, form sections) so the loading state
// reserves the same space and never reflows into a different shape.

const CELL_WIDTHS = [
  "w-24",
  "w-32",
  "w-20",
  "w-28",
  "w-16",
  "w-24",
  "w-20",
  "w-32",
]

export function PageHeaderSkeleton({
  action = true,
}: {
  action?: boolean | "link"
}) {
  return (
    <div
      aria-hidden
      className="mb-1 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Skeleton className="h-7 w-44 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action === "link" ? (
        <Skeleton className="h-4 w-24 shrink-0" />
      ) : action ? (
        <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
      ) : null}
    </div>
  )
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex h-[72px] items-center gap-3 rounded-lg border border-border bg-card px-4"
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChipRowSkeleton({
  widths = ["w-24", "w-24", "w-20", "w-28", "w-20", "w-24"],
}: {
  widths?: string[]
}) {
  return (
    <div aria-hidden className="flex flex-wrap gap-2">
      {widths.map((width, i) => (
        <Skeleton key={i} className={`h-[30px] rounded-full ${width}`} />
      ))}
    </div>
  )
}

export function TableCardSkeleton({
  rows = 8,
  columns = 5,
  toolbar = false,
  footer = false,
}: {
  rows?: number
  columns?: number
  toolbar?: boolean
  footer?: boolean
}) {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-9 w-full max-w-xs rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex h-10 items-center gap-4 border-b border-border bg-muted/40 px-3">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex h-14 items-center gap-4 border-b border-border px-3 last:border-b-0"
          >
            {Array.from({ length: columns }, (_, col) => (
              <Skeleton
                key={col}
                className={`h-4 ${CELL_WIDTHS[(row + col) % CELL_WIDTHS.length]}`}
              />
            ))}
          </div>
        ))}
      </div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-56 rounded-md" />
        </div>
      ) : null}
    </div>
  )
}

export function FormSectionSkeleton({
  fields = 4,
  columns = 2,
  titleWidth = "w-40",
}: {
  fields?: number
  columns?: 1 | 2
  titleWidth?: string
}) {
  return (
    <section
      aria-hidden
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border px-5 py-4">
        <Skeleton className={`h-5 ${titleWidth}`} />
        <Skeleton className="mt-2 h-3.5 w-3/5" />
      </div>
      <div
        className={
          columns === 2
            ? "grid gap-x-6 gap-y-6 px-5 py-5 @3xl/form-section:grid-cols-2"
            : "grid gap-y-6 px-5 py-5"
        }
      >
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 rounded-md" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function CategoryFormSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-xl">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </div>
        <div className="mt-6 flex flex-col gap-7">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-9 rounded-md" />
            </div>
          ))}
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function BannerFormSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-xl">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <div className="mt-6 flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-9 rounded-md" />
            </div>
          ))}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="aspect-[2/1] w-full rounded-xl" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function DetailCardSkeleton({
  lines = 3,
  titleWidth = "w-32",
}: {
  lines?: number
  titleWidth?: string
}) {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
    >
      <Skeleton className={`h-4 ${titleWidth}`} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={i === lines - 1 ? "h-3.5 w-2/3" : "h-3.5 w-full"}
        />
      ))}
    </div>
  )
}

export function ProductFormSkeleton() {
  return (
    <div aria-hidden className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-6 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="flex gap-2 @3xl/content:hidden">
        {["w-28", "w-24", "w-32"].map((width, i) => (
          <Skeleton key={i} className={`h-9 rounded-md ${width}`} />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 @3xl/content:grid-cols-[minmax(0,1fr)_300px] @5xl/content:grid-cols-[176px_minmax(0,1fr)_300px]">
        <div className="hidden @5xl/content:block">
          <Skeleton className="h-3 w-24" />
          <div className="mt-2 flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <FormSectionSkeleton fields={4} titleWidth="w-44" />
          <FormSectionSkeleton fields={2} columns={1} titleWidth="w-32" />
          <FormSectionSkeleton fields={4} titleWidth="w-24" />
          <FormSectionSkeleton fields={4} titleWidth="w-28" />
          <FormSectionSkeleton fields={2} titleWidth="w-40" />
        </div>

        <aside className="hidden flex-col gap-4 @3xl/content:flex">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <Skeleton className="h-2 w-full rounded-sm" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                </div>
              ))}
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </aside>
      </div>
    </div>
  )
}

export function ItemRowsSkeleton({
  rows = 4,
  count = 1,
}: {
  rows?: number
  count?: number
}) {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, group) => (
        <div
          key={group}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3.5 w-56 max-w-full" />
          </div>
          <div className="flex flex-col gap-2.5 p-4">
            {Array.from({ length: rows }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 rounded-lg border border-border px-3.5 py-3"
              >
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0 rounded-sm" />
                <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
