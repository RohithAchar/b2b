import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons";
import { publicImageUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ProductCardData = {
  id: string;
  title: string;
  price_per_unit: number;
  unit: string;
  moq: number;
  negotiable?: boolean;
  images?: { path: string; sort: number }[] | null;
  supplier?: {
    business_name?: string;
    city?: string;
    state?: string;
    logo_path?: string | null;
  } | null;
};

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function coverUrl(product: ProductCardData): string {
  const images = product.images;
  if (!images || images.length === 0) return "/placeholder.png";
  const sorted = [...images].sort((a, b) => a.sort - b.sort);
  return publicImageUrl("product_images", sorted[0].path);
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const isPlaceholder = !product.images || product.images.length === 0;
  const supplier = product.supplier?.business_name;
  const location = [product.supplier?.city, product.supplier?.state]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="group !gap-0 !py-0 overflow-hidden border-border transition-shadow hover:shadow-md">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {isPlaceholder ? (
            <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
              No image
            </div>
          ) : (
            <Image
              src={coverUrl(product)}
              alt={product.title}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
          {product.negotiable && (
            <span className="absolute left-2 top-2 rounded-sm bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
              Negotiable
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 max-sm:px-2 px-3 max-sm:py-2 py-2.5">
          <p className="line-clamp-1 text-sm font-medium">{product.title}</p>

          <p className="text-lg font-bold tracking-tight text-foreground">
            {formatPrice(product.price_per_unit)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              / {product.unit}
            </span>
          </p>

          <p className="text-xs font-medium text-foreground/70">
            MOQ: <span className="font-semibold">{product.moq}</span>{" "}
            {product.unit}
            {product.moq > 1 ? "s" : ""}
          </p>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-1 border-t border-border bg-muted/30 max-sm:px-2 px-3 max-sm:py-1.5 py-2">
        <div className="min-w-0">
          {supplier ? (
            <div className="flex items-center gap-1">
              <p className="truncate text-xs font-medium text-foreground/80">
                {supplier}
              </p>
              <span className="inline-flex shrink-0 items-center text-success">
                <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} className="size-3.5" />
              </span>
            </div>
          ) : null}
          {location ? (
            <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11px] text-muted-foreground">
              <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-3 shrink-0" />
              {location}
            </p>
          ) : null}
        </div>
        <Link href={`/products/${product.id}`} className="shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Enquiry
          </Button>
        </Link>
      </div>
    </Card>
  );
}