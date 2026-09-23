import { Skeleton } from "@/components/ui/skeleton"

export default function RootLoading() {
  return (
    <div aria-hidden className="flex min-h-screen flex-col">
      <div className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4">
          <Skeleton className="h-6 w-28 bg-card" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="hidden h-8 w-36 rounded-md bg-card sm:block" />
            <Skeleton className="size-8 rounded-full bg-card" />
          </div>
        </div>
      </div>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-5">
          <Skeleton className="h-56 rounded-lg bg-card" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg bg-card" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
