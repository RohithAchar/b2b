import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { publicImageUrl } from "@/lib/storage"
import { getHomeBanners, getNavigationCategories } from "@/lib/storefront"
import { getSessionUser } from "@/lib/auth/session"
import { StorefrontShell } from "@/components/layout/storefront-shell"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/storefront/section-header"
import {
  PopularCategoriesSection,
  SourceRegionsSection,
  VerifiedSuppliersSection,
  WholesaleDealsSection,
} from "@/components/storefront/home-sections"
import {
  CategoryGridSkeleton,
  ProductGridSkeleton,
  RegionGridSkeleton,
  SupplierGridSkeleton,
} from "@/components/storefront/skeletons"
import {
  HomeBannerCarousel,
  type HomeBanner,
} from "@/components/storefront/home-banner-carousel"

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
  )
  return banner.link_url ? <Link href={banner.link_url}>{strip}</Link> : strip
}

function CompactHero() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col justify-center rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="text-xs font-bold tracking-widest text-primary uppercase">
          Wholesale Marketplace from India
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
          Buy bulk. Sell direct.
          <br />
          Grow your trade.
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Discover verified Indian suppliers, compare wholesale prices, check
          MOQs, and source products directly from manufacturers and wholesalers
          across the country.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            size="lg"
            render={<Link href="/products" />}
            nativeButton={false}
          >
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
            <p className="mt-1 text-xs text-muted-foreground">
              Verified suppliers
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-bold text-primary">50,000+</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Wholesale products
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-bold text-primary">28</p>
            <p className="mt-1 text-xs text-muted-foreground">States covered</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-bold text-primary">₹0</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Buyer commission
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function HomePage() {
  const supabase = await createClient()
  const [sessionUser, banners, navCategories] = await Promise.all([
    getSessionUser(supabase),
    getHomeBanners(supabase),
    getNavigationCategories(supabase),
  ])

  const heroBanners = banners.filter((b) => b.slot === "hero")
  const promoBanner = banners.find((b) => b.slot === "promo")

  return (
    <StorefrontShell user={sessionUser} categories={navCategories}>
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
      <Suspense
        fallback={
          <section className="mx-auto w-full max-w-7xl px-4 py-6">
            <SectionHeader
              title="Popular Categories"
              subtitle="Top wholesale categories in demand"
              actionLabel="All categories"
              actionHref="/products"
            />
            <CategoryGridSkeleton count={6} />
          </section>
        }
      >
        <PopularCategoriesSection />
      </Suspense>

      {/* Wholesale deals */}
      <Suspense
        fallback={
          <section className="border-y border-border bg-card">
            <div className="mx-auto w-full max-w-7xl px-4 py-6">
              <SectionHeader
                title="Wholesale Deals"
                subtitle="Quoted wholesale prices directly from suppliers"
                actionLabel="View all"
                actionHref="/products"
              />
              <ProductGridSkeleton
                count={8}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              />
            </div>
          </section>
        }
      >
        <WholesaleDealsSection />
      </Suspense>

      {/* Source From India */}
      <Suspense
        fallback={
          <section className="mx-auto w-full max-w-7xl px-4 py-6">
            <SectionHeader
              title="Source From India"
              subtitle="Verified suppliers across Indian wholesale markets"
              actionLabel="Explore suppliers"
              actionHref="/products"
            />
            <RegionGridSkeleton count={4} />
          </section>
        }
      >
        <SourceRegionsSection />
      </Suspense>

      {/* Verified suppliers */}
      <Suspense
        fallback={
          <section className="mx-auto w-full max-w-7xl px-4 pb-8">
            <SectionHeader
              title="Verified Suppliers"
              subtitle="Trusted wholesale suppliers on the platform"
              actionLabel="Browse suppliers"
              actionHref="/products"
            />
            <SupplierGridSkeleton count={3} />
          </section>
        }
      >
        <VerifiedSuppliersSection />
      </Suspense>
    </StorefrontShell>
  )
}
