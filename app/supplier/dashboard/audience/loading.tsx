import { Skeleton } from "@/components/ui/skeleton";

export default function AudienceLoading() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading audience">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["All", "New", "Returning", "Imported"].map((label) => (
          <Skeleton key={label} className="h-8 w-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
