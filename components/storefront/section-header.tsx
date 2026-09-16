import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SectionHeader({
  title,
  actionLabel,
  actionHref,
  className,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-4 ${className ?? ""}`}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {actionLabel && actionHref ? (
        <Link href={actionHref}>
          <Button variant="ghost" size="sm">
            {actionLabel} →
          </Button>
        </Link>
      ) : null}
    </div>
  );
}