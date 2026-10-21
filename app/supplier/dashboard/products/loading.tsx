import { PageHeaderSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function SupplierProductsLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <PageHeaderSkeleton />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {["w-16", "w-20", "w-24", "w-20", "w-24"].map((width, i) => (
              <Skeleton key={i} className={`h-8 rounded-md ${width}`} />
            ))}
          </div>
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Skeleton className="h-9 w-full max-w-72 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-8 w-44 rounded-md" />
            </div>
          </div>
        </div>

        <div className="flex h-10 items-center gap-4 border-b border-border bg-muted/40 px-4">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <Skeleton className="h-5 w-20 rounded-sm" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        ))}

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-56 rounded-md" />
        </div>
      </div>
    </div>
  )
}
