import { Skeleton } from "@/components/ui/skeleton";

export default function TrafficAnalyticsLoading() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading traffic analytics">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-12 w-56" />
        <div className="flex flex-wrap gap-1.5">
          {["Today", "Last 7 days", "Last 30 days", "Lifetime"].map((label) => (
            <Skeleton key={label} className="h-8 w-24" />
          ))}
        </div>
      </div>
      {Array.from({ length: 3 }, (_, row) => (
        <div key={row} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className={row === 0 ? "h-28" : "h-72"} />
          <Skeleton className={row === 0 ? "h-28" : "h-72"} />
        </div>
      ))}
    </div>
  );
}
