import { CategoryPageGridSkeleton } from "@/components/storefront/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function CategoriesLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-6 mb-4 flex flex-wrap items-end justify-between gap-3 pb-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
      </div>
      <Skeleton className="mb-5 h-px w-full" />
      <CategoryPageGridSkeleton />
    </div>
  )
}
