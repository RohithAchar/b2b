import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/storage";
import {
  getFeaturedSuppliers,
  getHomeCategories,
  getHomeProducts,
  getSourceRegions,
} from "@/lib/storefront";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { SupplierCard } from "@/components/storefront/supplier-card";
import { SectionHeader } from "@/components/storefront/section-header";

function CategoryTile({
  cat,
}: {
  cat: { id: string; name: string; slug: string; image_path: string | null; product_count: number };
}) {
  return (
    <Link
      href={`/category/${cat.slug}`}
      className="group block w-[40vw] min-w-[132px] flex-none snap-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:w-auto md:min-w-0"
    >
      <Card className="gap-1 !py-0 overflow-hidden border-border transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-md">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {cat.image_path ? (
            <Image
              src={publicImageUrl("category_images", cat.image_path)}
              alt={cat.name}
              fill
              sizes="(min-width: 1024px) 12.5vw, (min-width: 768px) 25vw, 40vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/5 p-2 text-center text-sm font-semibold text-primary">
              {cat.name}
            </div>
          )}
        </div>
        <div className="px-2.5 py-2">
          <p className="line-clamp-2 text-sm font-semibold">{cat.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {cat.product_count} product{cat.product_count === 1 ? "" : "s"}
          </p>
        </div>
      </Card>
    </Link>
  );
}

function RegionCard({
  region,
}: {
  region: { state: string; cities: string[] };
}) {
  return (
    <Link href="/products" className="group block">
      <Card className="h-full p-4 border-border transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight">{region.state}</h3>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {region.cities.map((city) => (
            <span
              key={city}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/75"
            >
              <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-3 text-primary" />
              {city}
            </span>
          ))}
        </div>
      </Card>
    </Link>
  );
}

export async function PopularCategoriesSection() {
  const supabase = await createClient();
  const categories = await getHomeCategories(supabase);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6">
      <SectionHeader
        title="Popular Categories"
        subtitle="Top wholesale categories in demand"
        actionLabel="All categories"
        actionHref="/products"
      />
      {categories.length === 0 ? (
        <div className="py-4">
          <Empty>
            <EmptyTitle>No categories yet</EmptyTitle>
            <EmptyDescription>Categories appear here as they are created.</EmptyDescription>
          </Empty>
        </div>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 no-scrollbar snap-x snap-mandatory scroll-pl-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:scroll-pl-0 lg:grid-cols-8">
          {categories.map((cat) => (
            <CategoryTile key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </section>
  );
}

export async function WholesaleDealsSection() {
  const supabase = await createClient();
  const products = await getHomeProducts(supabase);

  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <SectionHeader
          title="Wholesale Deals"
          subtitle="Quoted wholesale prices directly from suppliers"
          actionLabel="View all"
          actionHref="/products"
        />
        {products.length === 0 ? (
          <div className="py-4">
            <Empty>
              <EmptyTitle>No products yet</EmptyTitle>
              <EmptyDescription>Products appear here as suppliers publish them.</EmptyDescription>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product as ProductCardData} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export async function SourceRegionsSection() {
  const supabase = await createClient();
  const regions = await getSourceRegions(supabase);

  if (regions.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6">
      <SectionHeader
        title="Source From India"
        subtitle="Verified suppliers across Indian wholesale markets"
        actionLabel="Explore suppliers"
        actionHref="/products"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {regions.map((region) => (
          <RegionCard key={region.state} region={region} />
        ))}
      </div>
    </section>
  );
}

export async function VerifiedSuppliersSection() {
  const supabase = await createClient();
  const featuredSuppliers = await getFeaturedSuppliers(supabase);

  if (featuredSuppliers.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-8">
      <SectionHeader
        title="Verified Suppliers"
        subtitle="Trusted wholesale suppliers on the platform"
        actionLabel="Browse suppliers"
        actionHref="/products"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {featuredSuppliers.map((supplier) => (
          <SupplierCard key={supplier.id} supplier={supplier} />
        ))}
      </div>
    </section>
  );
}