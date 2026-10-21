import { Skeleton } from "@/components/ui/skeleton"

export default function AdminProductsLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Skeleton className="h-6 w-48 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full max-w-72 rounded-md sm:w-72" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          {["w-20", "w-24", "w-24"].map((width, i) => (
            <Skeleton key={i} className={`h-8 rounded-md ${width}`} />
          ))}
        </div>
        <Skeleton className="h-px w-full rounded-none" />
        <div className="flex flex-col gap-2.5 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 rounded-lg border border-border px-3.5 py-3"
            >
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3.5 w-1/4" />
              </div>
              <Skeleton className="h-5 w-20 rounded-sm" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
