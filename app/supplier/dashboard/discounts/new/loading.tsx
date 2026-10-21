import { Skeleton } from "@/components/ui/skeleton"

export default function NewCouponLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
      </div>

      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="mt-6 flex flex-col gap-7">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-9 rounded-md" />
            </div>
          ))}
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>
    </div>
  )
}
