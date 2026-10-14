"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Award01Icon,
  CopyLinkIcon,
  GiftIcon,
  PercentIcon,
  ShoppingCart01Icon,
  Tag01Icon,
  TruckIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatRupees } from "@/lib/format";
import { toggleCoupon } from "@/lib/supplier/coupon-actions";
import {
  describeCoupon,
  type CouponRule,
  type CouponType,
} from "@/lib/supplier/coupons";

const TYPE_ICONS: Record<CouponType, IconSvgElement> = {
  percent: PercentIcon,
  flat: Tag01Icon,
  buy_x_get_y: ShoppingCart01Icon,
  free_shipping: TruckIcon,
  freebie: GiftIcon,
  loyalty: Award01Icon,
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="grid min-w-0 gap-0.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="truncate text-base font-bold tracking-tight tabular-nums">
        {children}
      </span>
    </span>
  );
}

/**
 * Coupon card: code + type icon, active toggle (the redemption gate),
 * rule description, real redemption stats from orders, and share action.
 */
export function CouponCard({
  coupon,
  freeProductTitle,
  timesUsed,
  totalSales,
  storePath,
}: {
  coupon: CouponRule;
  freeProductTitle: string | null;
  timesUsed: number;
  totalSales: number;
  storePath: string;
}) {
  const [active, setActive] = useState(coupon.is_active);
  const [pending, startTransition] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onToggle = (next: boolean) => {
    setActive(next);
    setToggleError(null);
    startTransition(async () => {
      const result = await toggleCoupon(coupon.id, next);
      if (!result.ok) {
        setActive(!next);
        setToggleError(result.message);
      }
    });
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${storePath}?coupon=${encodeURIComponent(coupon.code)}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card size="sm" className="!gap-0 !py-0">
      <CardContent className="flex flex-col gap-3 py-4">
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
            <HugeiconsIcon icon={TYPE_ICONS[coupon.type]} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight">
            {coupon.code}
          </span>
          <Switch
            size="sm"
            checked={active}
            disabled={pending}
            onCheckedChange={onToggle}
            aria-label={`${active ? "Deactivate" : "Activate"} coupon ${coupon.code}`}
          />
        </span>
        <p className="text-sm text-foreground/85">
          {describeCoupon(coupon, freeProductTitle)}
        </p>
        <span className="grid grid-cols-2 gap-2">
          <Stat label="Times used">{timesUsed}</Stat>
          <Stat label="Total sales">{formatRupees(totalSales)}</Stat>
        </span>
        {toggleError ? (
          <p role="alert" className="text-xs text-destructive">
            {toggleError}
          </p>
        ) : null}
        <Separator />
        <Button variant="outline" size="sm" className="w-full" onClick={share}>
          <HugeiconsIcon icon={CopyLinkIcon} strokeWidth={2} data-icon="inline-start" />
          {copied ? "Link copied" : "Share coupon"}
        </Button>
      </CardContent>
    </Card>
  );
}
