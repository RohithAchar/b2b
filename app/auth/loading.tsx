import { Skeleton } from "@/components/ui/skeleton"

export default function AuthLoading() {
  return (
    <div
      aria-hidden
      className="grid min-h-svh bg-background lg:grid-cols-[1fr_480px]"
    >
      <div className="hidden flex-col justify-between border-r border-border bg-card p-12 lg:flex">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-6 w-40" />
        </div>

        <div className="max-w-md">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="mt-3 h-9 w-full" />
          <Skeleton className="mt-2 h-9 w-3/4" />
          <div className="mt-8 flex max-w-md flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3"
              >
                <Skeleton className="mt-0.5 size-6 shrink-0 rounded-md" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-2 h-4 w-56 max-w-full" />
          <div className="mt-6 flex flex-col gap-4">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-px flex-1" />
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-px flex-1" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
