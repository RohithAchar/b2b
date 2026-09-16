import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
  className,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div
      className={`mb-3 flex items-end justify-between gap-4 border-b border-border pb-2 ${className ?? ""}`}
    >
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actionLabel && actionHref ? (
        <Link href={actionHref}>
          <Button
            variant="link"
            size="sm"
            className="h-7 text-sm font-semibold text-primary"
          >
            {actionLabel}
            <span aria-hidden>→</span>
          </Button>
        </Link>
      ) : null}
    </div>
  );
}