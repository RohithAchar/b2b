import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

// Structural skeletons that mirror their real layouts (same grids, spacing and
// aspect ratios) so loading reserves the exact space the content will occupy,
// avoiding layout shift. All ephemeral, non-interactive placeholder markup —
// never focusable, not announced by screen readers.

export function ProductCardSkeleton() {
  return (
    <Card className="!gap-0 !py-0 overflow-hidden border-border">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <div className="flex flex-col gap-2 max-sm:px-2 px-3 max-sm:py-2 py-2.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex items-center justify-between gap-1 border-t border-border bg-muted/30 max-sm:px-2 px-3 max-sm:py-1.5 py-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-7 w-16 rounded-md" />
      </div>
    </Card>
  );
}

export function ProductGridSkeleton({
  count = 24,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={
        className ??
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      }
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CategoryTileSkeleton() {
  return (
    <Card className="gap-1 !py-0 overflow-hidden border-border">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <div className="flex flex-col gap-1 px-2 py-1.5">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    </Card>
  );
}

export function CategoryGridSkeleton({
  count = 6,
}: {
  count?: number;
}) {
  return (
    <div
      aria-hidden
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
    >
      {Array.from({ length: count }, (_, i) => (
        <CategoryTileSkeleton key={i} />
      ))}
    </div>
  );
}

export function SupplierCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="size-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-sm" />
      </div>
      <div className="flex gap-1 p-2" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="relative aspect-square flex-1 overflow-hidden rounded-md bg-muted">
            <Skeleton className="absolute inset-0 rounded-none" />
          </div>
        ))}
      </div>
      <div className="px-4 pb-3 pt-1">
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </Card>
  );
}

export function SupplierGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SupplierCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RegionCardSkeleton() {
  return (
    <Card className="h-full p-4 border-border">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="size-4 rounded-full" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-14 rounded-sm" />
        ))}
      </div>
    </Card>
  );
}

export function RegionGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <RegionCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div aria-hidden className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-card">
          <Skeleton className="absolute inset-0 rounded-none" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-8 w-1/2" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-md" />
            <Skeleton className="h-14 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </div>
  );
}

export function ListingShellSkeleton({
  titleWidth,
  subtitleWidth,
}: {
  titleWidth: string;
  subtitleWidth: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-2">
      <div className="space-y-2">
        <Skeleton className={`h-5 ${titleWidth}`} />
        <Skeleton className={`h-3 ${subtitleWidth}`} />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  );
}