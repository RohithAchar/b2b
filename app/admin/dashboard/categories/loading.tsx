import { PageHeaderSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminCategoriesLoading() {
  return (
    <div aria-hidden className="mx-auto flex w-full flex-col gap-4">
      <PageHeaderSkeleton />

      {Array.from({ length: 2 }, (_, card) => (
        <div key={card} className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {Array.from({ length: 3 }, (_, row) => (
              <div
                key={row}
                className="flex items-center gap-3.5 rounded-lg border border-border px-3.5 py-3"
              >
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3.5 w-1/4" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-16 rounded-md" />
                  <Skeleton className="h-9 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>

          <Skeleton className="mt-3 h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}
