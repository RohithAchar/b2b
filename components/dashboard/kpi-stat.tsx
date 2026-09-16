import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";

export function KpiStat({
  label,
  value,
  caption,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon?: IconSvgElement;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("!gap-0 !py-0", className)}>
      <CardContent className="flex items-center gap-3 py-4">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
            <HugeiconsIcon icon={icon} strokeWidth={2} />
          </span>
        ) : null}
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {caption ? (
            <span className="truncate text-xs text-muted-foreground">
              {caption}
            </span>
          ) : null}
        </span>
      </CardContent>
    </Card>
  );
}