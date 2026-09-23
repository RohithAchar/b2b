import { Skeleton } from "@/components/ui/skeleton"

export default function StorefrontLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Skeleton className="h-48 rounded-lg bg-card" />
        <Skeleton className="hidden h-48 rounded-lg bg-card lg:block" />
      </div>
      <Skeleton className="mt-8 h-5 w-48" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg bg-card" />
        ))}
      </div>
    </div>
  )
}
