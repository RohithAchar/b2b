import { Suspense } from "react"
import type { Metadata } from "next"
import type { CatalogueSearchParams } from "@/lib/catalogue"
import { getCachedHomeBanners, getCachedStoreId } from "@/lib/storefront-cache"
import { publicImageUrl } from "@/lib/storage"
import { getBannerOutputSize } from "@/lib/admin/banner-images"
import type { BannerSlot } from "@/lib/admin/banner-slots"
import { AllProductsSection } from "@/components/storefront/home-sections"
import { SearchMegaMenuSection } from "@/components/storefront/search-mega-menu-section"
import { HomeBannerActions } from "@/components/storefront/home-banner-actions"
import { HomeHeroSection } from "@/components/storefront/home-hero"
import { NewSellerOfferPopup } from "@/components/storefront/new-seller-offer-popup"
import { TopCategoriesSection } from "@/components/storefront/home-categories"
import { RecentlyViewedSection } from "@/components/storefront/home-recently-viewed"
import { FrequentlyBoughtSection } from "@/components/storefront/frequently-bought"
import { RecommendedProductsSection } from "@/components/storefront/home-recommended"
import {
  CatalogueSkeleton,
  HomeHeroSkeleton,
  RecentRailSkeleton,
  RecommendedProductsSkeleton,
  SearchHeroSkeleton,
  TopCategoriesSkeleton,
} from "@/components/storefront/skeletons"

export const metadata: Metadata = {
  title: "Wholesale Marketplace from India",
  description:
    "Source wholesale products across textiles, electronics, chemicals, packaging and more — directly from verified Indian suppliers with live pricing.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Wholesale Marketplace from India",
    description:
      "Source wholesale products across textiles, electronics, chemicals, packaging and more — directly from verified Indian suppliers with live pricing.",
    url: "/",
  },
}

type BannerRow = { slot: string; title: string | null; link_url: string | null; image_path: string }

const DEFAULT_POPUP = {
  desktop: { src: "/promos/new-seller-offer.webp", width: 1200, height: 600 },
  mobile: { src: "/promos/new-seller-offer-mobile.webp", width: 900, height: 1599 },
}

/**
 * Offer popup for every visitor, signed in or not. Images come from
 * Dashboard → Banners (popup_desktop / popup_mobile); one upload covers every
 * device. Without either, the built-in art shows.
 */
async function OfferPopup() {
  const banners = (await getCachedHomeBanners()) as BannerRow[]

  const desktopRow = banners.find((b) => b.slot === "popup_desktop")
  const mobileRow = banners.find((b) => b.slot === "popup_mobile")
  const asImage = (row: BannerRow) => {
    const { width, height } = getBannerOutputSize(row.slot as BannerSlot)
    return { src: publicImageUrl("banners", row.image_path), width, height }
  }
  const desktop = desktopRow ?? mobileRow
  const mobile = mobileRow ?? desktopRow

  return (
    <NewSellerOfferPopup
      desktop={desktop ? asImage(desktop) : DEFAULT_POPUP.desktop}
      mobile={mobile ? asImage(mobile) : DEFAULT_POPUP.mobile}
      href={desktop?.link_url || mobile?.link_url || "/products"}
      alt={desktop?.title || mobile?.title || "Direct2Hub offer"}
    />
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<CatalogueSearchParams>
}) {
  const sp = await searchParams

  // The home page is the D2H Core storefront (cached lookup, no DB round trip).
  const coreStoreId = await getCachedStoreId("d2h-core")

  return (
    <div className="min-h-full bg-white">
      <h1 className="sr-only">
        Wholesale marketplace — source directly from verified Indian suppliers
      </h1>

      <Suspense fallback={<SearchHeroSkeleton />}>
        <SearchMegaMenuSection />
      </Suspense>

      {/* Admin hero banners. The placeholder holds the banner's space so the
          page doesn't jump when it streams in; it collapses if none exists. */}
      <Suspense fallback={<HomeHeroSkeleton />}>
        <HomeHeroSection />
      </Suspense>

      <HomeBannerActions />
      <Suspense fallback={null}>
        <OfferPopup />
      </Suspense>

      <Suspense fallback={<TopCategoriesSkeleton />}>
        <TopCategoriesSection />
      </Suspense>

      <Suspense fallback={<RecentRailSkeleton />}>
        <RecentlyViewedSection />
      </Suspense>

      {/* Buy again: personal and usually empty, so no placeholder (it would
          only flash and collapse for guests and new accounts). */}
      <Suspense fallback={null}>
        <FrequentlyBoughtSection />
      </Suspense>

      <Suspense fallback={<RecommendedProductsSkeleton />}>
        <RecommendedProductsSection storeId={coreStoreId} />
      </Suspense>

      <Suspense
        fallback={
          <section className="border-y border-border bg-muted/60">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:py-7">
              <CatalogueSkeleton />
            </div>
          </section>
        }
      >
        <AllProductsSection searchParams={sp} storeId={coreStoreId} />
      </Suspense>
    </div>
  )
}
