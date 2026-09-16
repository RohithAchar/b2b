import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";

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
    <Card className="overflow-hidden rounded-xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {supplier.logo_path ? (
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            <Image
              src={publicImageUrl("company_logos", supplier.logo_path)}
              alt={supplier.business_name}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium">
            {supplier.business_name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{supplier.business_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {supplier.city}, {supplier.state}
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Verified
        </span>
      </div>
      {supplier.product_images.length > 0 && (
        <div className="flex gap-1 p-2">
          {supplier.product_images.slice(0, 3).map((path, i) => (
            <div
              key={i}
              className="relative aspect-square flex-1 overflow-hidden rounded-lg bg-muted"
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
    </Card>
  );
}