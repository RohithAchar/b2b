import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_RANGES,
  DASHBOARD_RANGE_LABELS,
  type DashboardRange,
} from "@/lib/supplier/analytics";

/**
 * Date-range presets as link buttons (same GET-searchParams pattern as the
 * product tabs). Server-rendered, no client state; charts + metrics below
 * read the same `?range=` value.
 */
export function DashboardRangeFilter({ range }: { range: DashboardRange }) {
  return (
    <nav aria-label="Date range" className="flex flex-wrap gap-1.5">
      {DASHBOARD_RANGES.map((preset) => (
        <Button
          key={preset}
          render={<Link href={`/supplier/dashboard?range=${preset}`} />}
          nativeButton={false}
          variant={preset === range ? "default" : "outline"}
          size="sm"
        >
          {DASHBOARD_RANGE_LABELS[preset]}
        </Button>
      ))}
    </nav>
  );
}
