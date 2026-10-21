import { Skeleton } from "@/components/ui/skeleton"

export default function AdminProductReviewLoading() {
  return (
    <div aria-hidden className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Skeleton className="h-4 w-64 max-w-full" />

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-5 w-24 shrink-0 rounded-sm" />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-5 w-24 rounded-sm" />
          </div>
          <Skeleton className="h-px w-full" />

          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-16" />
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3"
                >
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 2 }, (_, i) => (
                <Skeleton key={i} className="aspect-video w-full rounded-lg" />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-28" />
            <div className="flex h-10 items-center gap-4 rounded-lg border border-border bg-muted/40 px-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="flex h-14 items-center gap-4 border-b border-border px-3 last:border-b-0"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-6">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </div>
  )
}
