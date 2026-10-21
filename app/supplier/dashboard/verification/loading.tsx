import { Skeleton } from "@/components/ui/skeleton"

export default function VerificationLoading() {
  return (
    <div aria-hidden className="flex w-full max-w-3xl flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <Skeleton className="h-7 w-40 max-w-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-sm" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-40" />
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
  )
}
