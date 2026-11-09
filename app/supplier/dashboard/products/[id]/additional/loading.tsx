import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-3xl p-6">
      <Skeleton className="h-4 w-48" />
      <div className="mt-4 rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <Skeleton className="mt-6 h-9 w-full" />
        <Skeleton className="mt-4 h-9 w-full" />
        <Skeleton className="mt-4 h-9 w-full" />
      </div>
    </div>
  );
}
