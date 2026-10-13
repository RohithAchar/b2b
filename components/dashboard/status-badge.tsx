import { Badge, badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

type StatusDef = { label: string; variant: BadgeVariant };

export const PRODUCT_STATUS: Record<string, StatusDef> = {
  draft: { label: "Draft", variant: "outline" },
  pending: { label: "Under review", variant: "warning" },
  approved: { label: "Live", variant: "success" },
  rejected: { label: "Needs changes", variant: "destructive" },
};

export const KYB_STATUS: Record<string, StatusDef> = {
  draft: { label: "Not submitted", variant: "outline" },
  pending: { label: "Under review", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Needs changes", variant: "destructive" },
};

export const VISIBILITY_STATUS: Record<string, StatusDef> = {
  active: { label: "Visible", variant: "success" },
  inactive: { label: "Hidden", variant: "outline" },
};

export const ORDER_STATUS: Record<string, StatusDef> = {
  new: { label: "New", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "secondary" },
  shipped: { label: "Shipped", variant: "default" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const MAPS = {
  product: PRODUCT_STATUS,
  kyb: KYB_STATUS,
  visibility: VISIBILITY_STATUS,
  order: ORDER_STATUS,
} as const;

export function StatusBadge({
  status,
  value,
  className,
}: {
  status: keyof typeof MAPS;
  value: string;
  className?: string;
}) {
  const def = MAPS[status][value] ?? {
    label: value,
    variant: "outline" as BadgeVariant,
  };
  return (
    <Badge variant={def.variant} className={className}>
      {def.label}
    </Badge>
  );
}