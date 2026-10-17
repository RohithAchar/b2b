// Notification trail for one order. Read-only and RLS-scoped: each party
// sees the notifications about their shared orders, and every state shown
// here is exactly what the provider confirmed (or, for the mock provider,
// explicitly labelled as "not a real message"). A failed notification never
// affected the order — this card just tells the truth about delivery.

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  NOTIFICATION_LABELS,
  type NotificationTemplate,
} from "@/lib/notifications/order-notifications";

type OutboxRow = {
  id: string;
  template: string;
  provider: string;
  status: string;
  error: string | null;
  created_at: string;
  last_attempt_at: string | null;
};

function formatDateTime(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusCell(row: OutboxRow): {
  label: string;
  variant: "default" | "secondary" | "outline";
  detail: string | null;
} {
  if (row.status === "sent") {
    if (row.provider === "mock") {
      return {
        label: "Mock only",
        variant: "outline",
        detail:
          "WhatsApp is not configured on this deployment, so this message was recorded but never actually sent.",
      };
    }
    return {
      label: "Sent",
      variant: "default",
      detail: `Confirmed by WhatsApp at ${formatDateTime(row.last_attempt_at)}`,
    };
  }
  if (row.status === "failed") {
    return {
      label: "Failed",
      variant: "outline",
      detail: row.error ?? "The provider rejected this message.",
    };
  }
  return {
    label: "Queued",
    variant: "secondary",
    detail: "Not yet confirmed by the provider.",
  };
}

export async function OrderNotifications({ orderId }: { orderId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_outbox")
    .select(
      "id, template, provider, status, error, created_at, last_attempt_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = (data ?? []) as unknown as OutboxRow[];
  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className="!gap-0 !pb-0">
      <CardHeader className="border-b border-border">
        <CardTitle>WhatsApp notifications</CardTitle>
        <CardDescription>
          Alerts sent about this order. The order never depends on them —
          states below are only what the provider confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent className="!px-0">
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const state = statusCell(row);
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm">
                    {NOTIFICATION_LABELS[row.template as NotificationTemplate] ?? row.template}
                  </p>
                  {state.detail ? (
                    <p className="text-xs text-muted-foreground">{state.detail}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(row.created_at)}
                  </span>
                  <Badge variant={state.variant}>{state.label}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
