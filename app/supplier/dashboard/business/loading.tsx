import { PageHeaderSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function BusinessLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <PageHeaderSkeleton />

      <div className="grid grid-cols-1 gap-4 @lg/content:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1.5 h-3.5 w-64 max-w-full" />
          </div>
          <div className="flex flex-col gap-6 px-5 py-5">
            <div className="flex items-center gap-4 rounded-lg border border-border p-3">
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 rounded-md" />
              </div>
            ))}
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        <div className="flex flex-col gap-4 @lg/content:sticky @lg/content:top-4 @lg/content:self-start">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="flex flex-col gap-5 px-5 py-5">
              {Array.from({ length: 3 }, (_, group) => (
                <div key={group} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 2 }, (_, row) => (
                      <div
                        key={row}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3"
                      >
                        <div className="flex flex-1 flex-col gap-1">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-16 rounded-sm" />
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <Skeleton className="h-2 w-full rounded-sm" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Skeleton className="size-4 shrink-0 rounded-full" />
                    <Skeleton className="h-3.5 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
