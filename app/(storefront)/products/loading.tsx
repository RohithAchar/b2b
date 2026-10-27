import { CatalogueSkeleton } from "@/components/storefront/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProductsLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[1440px] px-4 py-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4">
        <CatalogueSkeleton />
      </div>
    </div>
  )
}
