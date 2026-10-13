import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Inline ⓘ tooltip for card titles. */
export function InfoTip({ label, info }: { label: string; info: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`About ${label}`}
            className="flex shrink-0 items-center text-muted-foreground hover:text-foreground"
          />
        }
      >
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{info}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Metric card with an info tooltip and a previous-period delta.
 * Positive deltas use `text-success`, negative `text-destructive` — never
 * raw colors. `changePct` null (e.g. lifetime, no prior data) hides the
 * indicator.
 */
export function MetricCard({
  label,
  info,
  value,
  changePct,
  className,
}: {
  label: string;
  info: string;
  value: React.ReactNode;
  changePct: number | null;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("!gap-0 !py-0", className)}>
      <CardContent className="flex flex-col gap-2 py-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="truncate">{label}</span>
          <InfoTip label={label} info={info} />
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {changePct !== null && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-0.5 text-sm font-medium tabular-nums",
                changePct > 0 && "text-success",
                changePct < 0 && "text-destructive",
                changePct === 0 && "text-muted-foreground",
              )}
            >
              {changePct > 0 ? (
                <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2.5} className="size-4" />
              ) : changePct < 0 ? (
                <HugeiconsIcon icon={ArrowDownRight01Icon} strokeWidth={2.5} className="size-4" />
              ) : null}
              {changePct === 0 ? "0%" : `${Math.abs(changePct)}%`}
            </span>
          )}
        </span>
      </CardContent>
    </Card>
  );
}
