import { Skeleton } from "@/components/ui/skeleton"

export default function AdminBannersLoading() {
  return (
    <div aria-hidden className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="mb-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-1.5 h-4 w-80 max-w-full" />
      </div>

      {[
        { label: "w-40", aspect: "aspect-[12/5]" },
        { label: "w-48", aspect: "aspect-[1248/128]" },
      ].map((slot, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-2">
              <Skeleton className={`h-5 ${slot.label}`} />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-16 rounded-sm" />
              <Skeleton className={`w-full rounded-lg ${slot.aspect}`} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-9 w-24 rounded-md" />
                  <Skeleton className="h-8 w-16 rounded-md" />
                  <Skeleton className="h-9 w-20 rounded-md" />
                </div>
              </div>
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
