import { Skeleton } from "@/components/ui/skeleton"

export default function ProductsAnalyticsLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["w-16", "w-24", "w-24", "w-20"].map((width, i) => (
            <Skeleton key={i} className={`h-8 rounded-md ${width}`} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {["lg:col-span-2", "lg:col-span-3"].map((span) => (
          <div
            key={span}
            className={`overflow-hidden rounded-lg border border-border bg-card p-6 ${span}`}
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-3.5 w-48" />
            <Skeleton className="mt-6 h-48 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-5 w-36" />
        <div className="mt-4 flex flex-col gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md border border-border p-3"
            >
              <Skeleton className="size-14 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
