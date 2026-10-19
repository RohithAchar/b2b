import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";

export type KpiAccent = "primary" | "warning" | "info" | "success" | "violet";

const ACCENT_CLASS: Record<KpiAccent, string> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  violet: "bg-violet/10 text-violet",
};

export function KpiStat({
  label,
  value,
  caption,
  icon,
  accent = "primary",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon?: IconSvgElement;
  accent?: KpiAccent;
  /** When set, the whole card links to the matching filtered view. */
  href?: string;
  className?: string;
}) {
  const card = (
    <Card
      size="sm"
      className={cn(
        "!gap-0 !py-0 h-full transition-shadow",
        href && "hover:border-primary/40 hover:shadow-md focus-within:shadow-md",
        className,
      )}
    >
      <CardContent className="flex items-center gap-3 py-4">
        {icon ? (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
              ACCENT_CLASS[accent],
            )}
          >
            <HugeiconsIcon icon={icon} strokeWidth={2} />
          </span>
        ) : null}
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">
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

  if (!href) return card;
  return (
    <Link
      href={href}
      className="block h-full min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  );
}
