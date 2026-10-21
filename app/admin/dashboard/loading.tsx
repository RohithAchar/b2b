import { Skeleton } from "@/components/ui/skeleton"

export default function AdminOverviewLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="mb-1 grid min-w-0 gap-0.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-1 h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-4 @lg/content:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex h-[74px] flex-col justify-center gap-1.5 rounded-lg border border-border bg-card px-6"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 @lg/content:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }, (_, card) => (
            <div
              key={card}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="flex items-center justify-between gap-3 px-6 pt-6">
                <div className="grid gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <div className="flex flex-col gap-2.5 p-6">
                {Array.from({ length: card === 0 ? 3 : 2 }, (_, row) => (
                  <div
                    key={row}
                    className="flex items-center gap-3.5 rounded-lg border border-border px-3.5 py-3"
                  >
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3.5 w-2/3" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <div className="grid gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
