import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/storage";
import { getHomepageData, getFeaturedSuppliers, getHomeBanners } from "@/lib/storefront";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { StorefrontFooter } from "@/components/layout/storefront-footer";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  HomeBannerCarousel,
  type HomeBanner,
} from "@/components/storefront/home-banner-carousel";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { SupplierCard } from "@/components/storefront/supplier-card";
import { SectionHeader } from "@/components/storefront/section-header";

function PromoBanner({ banner }: { banner: HomeBanner }) {
  const strip = (
    <div className="relative h-32 overflow-hidden rounded-xl bg-muted">
      <Image
        src={publicImageUrl("banners", banner.image_path)}
        alt={banner.title ?? "Promotional banner"}
        fill
        sizes="(min-width: 1280px) 1216px, 100vw"
        className="object-cover"
      />
      {banner.title || banner.subtitle ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
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

function BannerPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20">
      <EmptyTitle className="text-sm font-normal">{children}</EmptyTitle>
    </div>
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
  const heroBanners = banners.filter((b) => b.slot === "hero");
  const promoBanner = banners.find((b) => b.slot === "promo");

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader
        user={user ? { email: user.email!, user_type: userType ?? "buyer" } : null}
      />

      <main className="flex-1">
        {/* Hero banner carousel */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-6">
          {heroBanners.length > 0 ? (
            <HomeBannerCarousel banners={heroBanners} />
          ) : (
            <div className="h-64">
              <BannerPlaceholder>No hero banner set</BannerPlaceholder>
            </div>
          )}
        </section>

        {/* Category grid */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-10">
          <SectionHeader title="Browse Categories" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/category/${cat.slug}`}>
                <Card className="group overflow-hidden rounded-xl transition-[box-shadow,border-color] hover:ring-foreground/20 hover:shadow-sm">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    {cat.image_path ? (
                      <Image
                        src={publicImageUrl("category_images", cat.image_path)}
                        alt={cat.name}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        {cat.name}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.product_count} product{cat.product_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Promotional banner */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-8">
          {promoBanner ? (
            <PromoBanner banner={promoBanner} />
          ) : (
            <div className="h-32">
              <BannerPlaceholder>No promotional banner set</BannerPlaceholder>
            </div>
          )}
        </section>

        <Separator className="mx-auto w-full max-w-7xl" />

        {/* New arrivals */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-8">
          <SectionHeader title="New Arrivals" actionLabel="View all" actionHref="/products" />
          {products.length === 0 ? (
            <div className="py-8">
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
        </section>

        <Separator className="mx-auto w-full max-w-7xl" />

        {/* Featured suppliers */}
        {featuredSuppliers.length > 0 && (
          <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-8">
            <SectionHeader title="Featured Suppliers" />
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