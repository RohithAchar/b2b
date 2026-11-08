import { cn } from "cn";

export function TopBar({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-4", className)}>
      <div className="grid min-w-0 flex-1 gap-1">
        {/* p, not h1: every dashboard page renders its own h1. */}
        <p className="truncate text-base font-medium">{title}</p>
        {description ? (
          <p className="truncate text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}