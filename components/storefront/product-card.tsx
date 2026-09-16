import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";

export type ProductCardData = {
  id: string;
  title: string;
  price_per_unit: number;
  unit: string;
  moq: number;
  images?: { path: string; sort: number }[] | null;
  supplier?: { business_name?: string } | null;
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

  return (
    <Link href={`/products/${product.id}`} className="block">
      <Card className="group overflow-hidden rounded-xl transition-[box-shadow,border-color] hover:ring-foreground/20 hover:shadow-sm">
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
        </div>
        <div className="flex flex-col gap-1 px-3 py-2.5">
          <p className="line-clamp-1 text-sm font-medium">{product.title}</p>
          <p className="text-sm font-semibold">
            {formatPrice(product.price_per_unit)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              / {product.unit}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">MOQ: {product.moq}+</p>
          {product.supplier?.business_name && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {product.supplier.business_name}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}