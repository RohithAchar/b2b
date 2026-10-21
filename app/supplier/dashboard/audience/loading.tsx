import { Skeleton } from "@/components/ui/skeleton"

export default function AudienceLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["w-16", "w-24", "w-24", "w-20"].map((width, i) => (
            <Skeleton key={i} className={`h-8 rounded-md ${width}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full max-w-xs rounded-md" />
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["w-16", "w-20", "w-24", "w-20"].map((width, i) => (
          <Skeleton key={i} className={`h-8 rounded-md ${width}`} />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex h-10 items-center gap-4 border-b border-border bg-muted/40 px-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {Array.from({ length: 8 }, (_, row) => (
          <div
            key={row}
            className="flex h-14 items-center gap-4 border-b border-border px-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-5 w-20 rounded-sm" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-56 rounded-md" />
      </div>
    </div>
  )
}
