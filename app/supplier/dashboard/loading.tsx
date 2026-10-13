import { Skeleton } from "@/components/ui/skeleton";

export default function SupplierDashboardLoading() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["Today", "Last 7 days", "Last 30 days", "Lifetime"].map((label) => (
          <Skeleton key={label} className="h-8 w-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
