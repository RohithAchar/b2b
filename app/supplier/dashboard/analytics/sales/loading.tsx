import { Skeleton } from "@/components/ui/skeleton"

export default function SalesAnalyticsLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["w-16", "w-24", "w-24", "w-20"].map((width, i) => (
            <Skeleton key={i} className={`h-8 rounded-md ${width}`} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex h-[92px] flex-col justify-center gap-2 rounded-lg border border-border bg-card px-4"
          >
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-2 w-full rounded-sm" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-border bg-card p-6"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-3.5 w-40" />
            <Skeleton className="mt-6 h-56 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-border bg-card p-6"
          >
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 4 }, (_, row) => (
              <div
                key={row}
                className="mt-2 flex items-center justify-between gap-3"
              >
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
