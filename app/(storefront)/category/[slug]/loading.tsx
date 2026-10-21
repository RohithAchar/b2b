import { ProductGridSkeleton } from "@/components/storefront/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function CategoryLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-4 w-56" />
      <div className="mt-4 mb-4 flex items-center gap-4 pb-4">
        <Skeleton className="size-16 shrink-0 rounded-md" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <Skeleton className="mb-5 h-px w-full" />
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-4 w-28" />
        {["w-20", "w-24", "w-16"].map((width, i) => (
          <Skeleton key={i} className={`h-7 rounded-sm ${width}`} />
        ))}
      </div>
      <ProductGridSkeleton count={20} />
    </div>
  )
}
