import { Skeleton } from "@/components/ui/skeleton";

export default function SalesAnalyticsLoading() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading sales analytics">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-12 w-56" />
        <div className="flex flex-wrap gap-1.5">
          {["Today", "Last 7 days", "Last 30 days", "Lifetime"].map((label) => (
            <Skeleton key={label} className="h-8 w-24" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}
