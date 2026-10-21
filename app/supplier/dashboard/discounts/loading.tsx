import { Skeleton } from "@/components/ui/skeleton"

export default function DiscountsLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-xs rounded-md" />
        <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["w-14", "w-28", "w-24", "w-32", "w-24"].map((width, i) => (
          <Skeleton key={i} className={`h-8 rounded-md ${width}`} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-4"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 2 }, (_, stat) => (
                <div key={stat} className="flex flex-col gap-1.5">
                  <Skeleton className="h-2.5 w-12" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
