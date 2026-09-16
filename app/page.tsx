import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/storage";
import {
  getHomepageData,
  getFeaturedSuppliers,
  getHomeBanners,
  getNavigationCategories,
  getSourceRegions,
} from "@/lib/storefront";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { StorefrontFooter } from "@/components/layout/storefront-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  HomeBannerCarousel,
  type HomeBanner,
} from "@/components/storefront/home-banner-carousel";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { SupplierCard } from "@/components/storefront/supplier-card";
import { SectionHeader } from "@/components/storefront/section-header";

function PromoBanner({ banner }: { banner: HomeBanner }) {
  const strip = (
    <div className="relative h-24 overflow-hidden rounded-lg border border-border bg-muted">
      <Image
        src={publicImageUrl("banners", banner.image_path)}
        alt={banner.title ?? "Promotional banner"}
        fill
        sizes="(min-width: 1280px) 1216px, 100vw"
        className="object-cover"
      />
      {banner.title || banner.subtitle ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
          {banner.title ? (
            <p className="text-sm font-semibold text-white">{banner.title}</p>
          ) : null}
          {banner.subtitle ? (
            <p className="text-xs text-white/90">{banner.subtitle}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
  return banner.link_url ? <Link href={banner.link_url}>{strip}</Link> : strip;
}

function CompactHero() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col justify-center rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Wholesale Marketplace from India
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
          Buy bulk. Sell direct.
          <br />
          Grow your trade.
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Discover verified Indian suppliers, compare wholesale prices, check
          MOQs, and source products directly from manufacturers and
          wholesalers across the country.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button size="lg" render={<Link href="/products" />} nativeButton={false}>
            Browse Products
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-border bg-card"
            render={<Link href="/supplier/onboarding" />}
            nativeButton={false}
          >
            Become a Supplier
          </Button>
        </div>
      </div>
      <div className="hidden flex-col justify-center gap-3 lg:flex">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-bold text-primary">10,000+</p>
            <p className="mt-1 text-xs text-muted-foreground">Verified suppliers</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-bold text-primary">50,000+</p>
            <p className="mt-1 text-xs text-muted-foreground">Wholesale products</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-bold text-primary">28</p>
            <p className="mt-1 text-xs text-muted-foreground">States covered</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-bold text-primary">₹0</p>
            <p className="mt-1 text-xs text-muted-foreground">Buyer commission</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryTile({
  cat,
}: {
  cat: { id: string; name: string; slug: string; image_path: string | null; product_count: number };
}) {
  return (
    <Link href={`/category/${cat.slug}`} className="group">
      <Card className="group gap-1 !py-0 overflow-hidden border-border transition-shadow hover:shadow-md">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {cat.image_path ? (
            <Image
              src={publicImageUrl("category_images", cat.image_path)}
              alt={cat.name}
              fill
              sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/5 p-2 text-center text-sm font-semibold text-primary">
              {cat.name}
            </div>
          )}
        </div>
        <div className="px-2 py-1.5">
          <p className="line-clamp-1 text-xs font-semibold">{cat.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {cat.product_count} item{cat.product_count !== 1 ? "s" : ""}
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

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userType: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();
    userType = profile?.user_type ?? null;
  }

  const { categories, products } = await getHomepageData(supabase);
  const featuredSuppliers = await getFeaturedSuppliers(supabase);
  const banners = await getHomeBanners(supabase);
  const navCategories = await getNavigationCategories(supabase);
  const regions = await getSourceRegions(supabase);
  const heroBanners = banners.filter((b) => b.slot === "hero");
  const promoBanner = banners.find((b) => b.slot === "promo");

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader
        user={user ? { email: user.email!, user_type: userType ?? "buyer" } : null}
        categories={navCategories}
      />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-4">
            {heroBanners.length > 0 ? (
              <HomeBannerCarousel banners={heroBanners} />
            ) : (
              <CompactHero />
            )}
          </div>
        </section>

        {/* Promo strip */}
        {promoBanner && (
          <section className="mx-auto w-full max-w-7xl px-4 pt-4">
            <PromoBanner banner={promoBanner} />
          </section>
        )}

        {/* Popular categories */}
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {categories.map((cat) => (
                <CategoryTile key={cat.id} cat={cat} />
              ))}
            </div>
          )}
        </section>

        {/* Wholesale deals */}
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

        {/* Source From India */}
        {regions.length > 0 && (
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
        )}

        {/* Verified suppliers */}
        {featuredSuppliers.length > 0 && (
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
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
}
