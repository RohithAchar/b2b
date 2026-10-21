import {
  KpiRowSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function SupplierDashboardLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-56 max-w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-5 w-20 rounded-sm" />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["w-16", "w-24", "w-24", "w-20"].map((width, i) => (
            <Skeleton key={i} className={`h-8 rounded-md ${width}`} />
          ))}
        </div>
      </div>

      <KpiRowSkeleton />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, card) => (
          <div
            key={card}
            className="overflow-hidden rounded-lg border border-border bg-card p-6"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-2 h-3.5 w-48" />
            <Skeleton className="mt-6 h-64 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <TableCardSkeleton rows={5} columns={6} />
    </div>
  )
}
