import { Skeleton } from "@/components/ui/skeleton"

export default function SupplierQuoteLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-6 w-44" />
        </div>
        <Skeleton className="h-4 w-28" />
      </div>

      <Skeleton className="h-4 w-full max-w-3xl" />
      <Skeleton className="h-4 w-2/3 max-w-2xl" />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-1.5 h-3.5 w-64 max-w-full" />
        </div>
        <div className="flex h-10 items-center gap-4 border-b border-border bg-muted/40 px-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        ))}
        <div className="flex flex-col gap-6 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 rounded-md" />
              </div>
            ))}
          </div>
          <Skeleton className="h-24 rounded-md" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-40 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
