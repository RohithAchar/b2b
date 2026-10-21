import { ProductGridSkeleton } from "@/components/storefront/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProductsLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-4 w-40" />
      <div className="my-4 flex flex-wrap gap-1.5">
        <Skeleton className="h-7 w-16 rounded-sm" />
        <Skeleton className="h-7 w-20 rounded-sm" />
        <Skeleton className="h-7 w-24 rounded-sm" />
        <Skeleton className="h-7 w-20 rounded-sm" />
      </div>
      <div className="mb-4 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <ProductGridSkeleton count={20} />
    </div>
  )
}
