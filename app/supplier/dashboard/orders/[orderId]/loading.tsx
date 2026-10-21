import { DetailCardSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function SupplierOrderDetailLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-24 rounded-sm" />
          <Skeleton className="h-5 w-20 rounded-sm" />
        </div>
        <Skeleton className="h-4 w-32" />
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
        {Array.from({ length: 5 }, (_, i) => (
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

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 5 }, (_, row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3"
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        ))}
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

      <DetailCardSkeleton lines={4} titleWidth="w-24" />

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
