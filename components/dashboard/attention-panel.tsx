import Link from "next/link";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";

export type AttentionItem = {
  id: string;
  title: string;
  description?: string;
  severity: "error" | "warning" | "info";
  href: string;
  actionLabel?: string;
};

const SEVERITY_DOT: Record<AttentionItem["severity"], string> = {
  error: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

export function AttentionPanel({
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  className,
}: {
  title: string;
  description?: string;
  items: AttentionItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  return (
    <Card className={cn("!gap-0 !py-0", className)}>
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle>{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="!px-0 !py-1">
        {items.length === 0 ? (
          <Empty className="!border-0 !p-8">
            <EmptyTitle>{emptyTitle ?? "All clear"}</EmptyTitle>
            <EmptyDescription>
              {emptyDescription ?? "Nothing needs your attention right now."}
            </EmptyDescription>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", SEVERITY_DOT[item.severity])}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.title}
                  </span>
                  {item.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                <Button
                  render={<Link href={item.href} />}
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                >
                  {item.actionLabel ?? "View"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}