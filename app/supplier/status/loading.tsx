import { Skeleton } from "@/components/ui/skeleton"

export default function SupplierStatusLoading() {
  return (
    <div aria-hidden className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-2/3" />
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
