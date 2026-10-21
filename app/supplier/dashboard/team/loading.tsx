import { ItemRowsSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function TeamLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Skeleton className="h-7 w-40 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-5 w-16 shrink-0 rounded-sm" />
      </div>

      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-1.5 h-3.5 w-64 max-w-full" />
        </div>
        <div className="px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        <ItemRowsSkeleton rows={4} />
      </div>
    </div>
  )
}
