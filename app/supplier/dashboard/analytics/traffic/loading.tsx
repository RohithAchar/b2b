import { Skeleton } from "@/components/ui/skeleton"

export default function TrafficAnalyticsLoading() {
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

      {Array.from({ length: 3 }, (_, row) => (
        <div key={row} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, col) =>
            row === 0 ? (
              <div
                key={col}
                className="flex h-28 flex-col justify-center gap-2 rounded-lg border border-border bg-card px-4"
              >
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-7 w-1/2" />
              </div>
            ) : (
              <div
                key={col}
                className="overflow-hidden rounded-lg border border-border bg-card p-6"
              >
                <Skeleton className="h-5 w-36" />
                <Skeleton className="mt-2 h-3.5 w-48" />
                <Skeleton className="mt-6 h-48 w-full rounded-lg" />
              </div>
            )
          )}
        </div>
      ))}
    </div>
  )
}
