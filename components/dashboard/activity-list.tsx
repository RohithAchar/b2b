import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";

export type ActivityItem = {
  id: string;
  title: string;
  description?: string;
  time?: string;
  icon?: IconSvgElement;
  iconClassName?: string;
  tabs?: React.ReactNode;
};

export function ActivityList({
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  className,
}: {
  title: string;
  description?: string;
  items: ActivityItem[];
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
            <EmptyTitle>{emptyTitle ?? "Nothing yet"}</EmptyTitle>
            <EmptyDescription>
              {emptyDescription ?? "Recent activity will show up here."}
            </EmptyDescription>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                {item.tabs}
                {item.icon ? (
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4",
                      item.iconClassName,
                    )}
                  >
                    <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  </span>
                ) : null}
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
                {item.time ? (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {item.time}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}