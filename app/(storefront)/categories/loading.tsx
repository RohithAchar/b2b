import { Skeleton } from "@/components/ui/skeleton"

export default function CategoriesLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-6 mb-4 pb-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-1.5 h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="mb-5 h-px w-full" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-24 rounded-sm" />
              </div>
              <Skeleton className="h-7 w-20 rounded-sm" />
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["w-20", "w-16", "w-24"].map((width, chip) => (
                <Skeleton key={chip} className={`h-7 rounded-sm ${width}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
