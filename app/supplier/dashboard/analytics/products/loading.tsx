import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsAnalyticsLoading() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading products analytics">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-12 w-56" />
        <div className="flex flex-wrap gap-1.5">
          {["Today", "Last 7 days", "Last 30 days", "Lifetime"].map((label) => (
            <Skeleton key={label} className="h-8 w-24" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72 lg:col-span-3" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
