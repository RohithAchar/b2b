import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, ShieldCheckIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { publicImageUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type SupplierCardData = {
  id: string;
  business_name: string;
  city: string;
  state: string;
  logo_path: string | null;
  product_images: string[];
};

export function SupplierCard({ supplier }: { supplier: SupplierCardData }) {
  return (
    <Card className="overflow-hidden border-border transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {supplier.logo_path ? (
          <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            <Image
              src={publicImageUrl("company_logos", supplier.logo_path)}
              alt={supplier.business_name}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
            {supplier.business_name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{supplier.business_name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-3 shrink-0" />
            {supplier.city}, {supplier.state}
          </p>
        </div>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm bg-success/10 px-1.5 py-1 text-[11px] font-semibold text-success">
          <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} className="size-3" />
          Verified
        </span>
      </div>
      {supplier.product_images.length > 0 && (
        <div className="flex gap-1 p-2">
          {supplier.product_images.slice(0, 3).map((path, i) => (
            <div
              key={i}
              className="relative aspect-square flex-1 overflow-hidden rounded-md bg-muted"
            >
              <Image
                src={publicImageUrl("product_images", path)}
                alt=""
                fill
                sizes="(min-width: 1024px) 12vw, (min-width: 640px) 25vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
      <div className="px-4 pb-3 pt-1">
        <Link href={`/products`}>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-border text-foreground hover:border-primary hover:text-primary"
          >
            View Supplier
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
        </Link>
      </div>
    </Card>
  );
}