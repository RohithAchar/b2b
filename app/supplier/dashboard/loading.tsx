import { Skeleton } from "@/components/ui/skeleton"

export default function SupplierDashboardLoading() {
  return (
    <div aria-hidden className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-12 w-full max-w-md" />
      <Skeleton className="h-72 rounded-lg" />
    </div>
  )
}
