import { Skeleton } from "@/components/ui/skeleton"

export default function AdminSupplierReviewLoading() {
  return (
    <div aria-hidden className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Skeleton className="h-4 w-72 max-w-full" />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="size-12 shrink-0 rounded-lg" />
          </div>

          <div className="mt-6 flex flex-col gap-6">
            {Array.from({ length: 4 }, (_, group) => (
              <div key={group} className="flex flex-col gap-3">
                <Skeleton className="h-4 w-32" />
                <div className="flex flex-col gap-2.5">
                  {Array.from({ length: group === 3 ? 3 : 2 }, (_, row) => (
                    <div
                      key={row}
                      className="flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3"
                    >
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-1/2" />
                      {group === 3 ? (
                        <Skeleton className="mt-2 h-48 w-full rounded-lg" />
                      ) : null}
                    </div>
                  ))}
                </div>
                {group < 3 ? <Skeleton className="h-px w-full" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-6 lg:sticky lg:top-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-20 rounded-md" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
