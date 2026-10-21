import { Skeleton } from "@/components/ui/skeleton"

export default function OnboardingLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-2xl p-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />

        <div className="mt-6 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-1 w-full rounded-sm" />
              </div>
            ))}
          </div>

          <Skeleton className="h-4 w-48" />

          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 rounded-md" />
              </div>
            ))}
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-9 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 flex-1 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
