import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons";
import { publicTransformedImageUrl } from "@/lib/storage";
import type { CustomerPrices } from "@/lib/pricing";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardAddButton } from "@/components/storefront/card-add-button";

export type ProductCardData = {
  id: string;
  title: string;
  unit: string;
  moq: number;
  negotiable?: boolean;
  images?: { path: string; sort: number }[] | null;
  pricing: CustomerPrices | null;
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
  return publicTransformedImageUrl("product_images", sorted[0].path, { width: 640 });
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const isPlaceholder = !product.images || product.images.length === 0;
  const supplier = product.supplier?.business_name;
  const location = [product.supplier?.city, product.supplier?.state]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="group !gap-0 !py-0 overflow-hidden border-0 transition-shadow hover:shadow-md">
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
            <Badge className="absolute left-2 top-2">Negotiable</Badge>
          )}
        </div>

        <CardContent className="flex flex-col gap-1 px-3 py-2.5 max-sm:px-2 max-sm:py-2">
          <p className="line-clamp-1 text-sm font-medium">{product.title}</p>

          {product.pricing ? (
            <p className="text-base font-bold tracking-tight text-foreground tabular-nums sm:text-lg">
              {formatPrice(product.pricing.customer_price)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / {product.unit}
              </span>
            </p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              Price on request
            </p>
          )}

          <p className="text-xs font-medium text-foreground/70">
            MOQ: <span className="font-semibold">{product.moq}</span>{" "}
            {product.unit}
            {product.moq > 1 ? "s" : ""}
          </p>
        </CardContent>
      </Link>

      <CardFooter className="flex-col items-stretch gap-1.5 bg-muted/30 px-3 py-2 max-sm:px-2 max-sm:py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
        <div className="min-w-0">
          {supplier ? (
            <div className="flex items-center gap-1">
              <p className="truncate text-xs font-medium text-foreground/80">
                {supplier}
              </p>
              <span className="inline-flex shrink-0 items-center text-success">
                <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} className="size-3.5" />
                <span className="sr-only">Verified supplier</span>
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
        <div className="shrink-0 sm:flex sm:items-center">
          <CardAddButton productId={product.id} moq={product.moq} />
        </div>
      </CardFooter>
    </Card>
  );
}