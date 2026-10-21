import { Skeleton } from "@/components/ui/skeleton"

export default function MarginLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-4">
      <div className="mb-1 grid min-w-0 gap-1.5">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-1.5 h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex flex-col gap-6 px-5 py-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-9 rounded-md" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
    </div>
  )
}
