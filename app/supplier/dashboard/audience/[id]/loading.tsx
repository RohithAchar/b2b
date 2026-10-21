import { KpiRowSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function AudienceDetailLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <Skeleton className="h-6 w-48 max-w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
      </div>

      <KpiRowSkeleton />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="overflow-hidden rounded-lg border border-border bg-card lg:col-span-4">
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="flex h-10 items-center gap-4 border-b border-border bg-muted/40 px-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto h-3 w-14" />
            <Skeleton className="h-3 w-16" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="flex h-14 items-center gap-4 border-b border-border px-5 last:border-b-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="h-5 w-20 rounded-sm" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between gap-2"
              >
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
