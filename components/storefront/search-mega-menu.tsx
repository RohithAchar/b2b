"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageSearchButton } from "@/components/storefront/image-search-button";
import { SearchSuggestionsDropdown } from "@/components/storefront/search-suggestions";
import { useSearchSuggestions } from "@/components/storefront/use-search-suggestions";
import {
  normalizeSuggestQuery,
  SUGGEST_MIN_CHARS,
} from "@/lib/search-suggest";
import {
  publicTransformedImageUrl,
} from "@/lib/storage";

export type MegaMenuSubcategory = {
  id: string;
  name: string;
  slug: string;
  /**
   * Storage path in the `category_images` bucket. Resolved via
   * `publicTransformedImageUrl` when set.
   */
  image_path?: string | null;
  /**
   * Direct display URL override (used by Storybook mocks so thumbnails
   * render without a storage bucket). Takes precedence over `image_path`.
   */
  imageUrl?: string | null;
};

export type MegaMenuCategory = {
  id: string;
  name: string;
  slug: string;
  image_path: string | null;
  product_count: number;
  subcategories: MegaMenuSubcategory[];
};

export type MegaMenuSuggestion = {
  id: string;
  label: string;
  hint?: string;
};

/**
 * Small square subcategory thumbnail (visual only). Shows the image when a
 * URL or storage path is provided, otherwise a monogram fallback tile.
 */
function SubThumb({ sub }: { sub: MegaMenuSubcategory }) {
  const src =
    sub.imageUrl ??
    (sub.image_path
      ? publicTransformedImageUrl("category_images", sub.image_path, {
          width: 100,
        })
      : null);
  if (!src) {
    return (
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-sm font-bold text-primary"
      >
        {sub.name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="relative block size-10 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes="40px"
        className="object-cover"
      />
    </span>
  );
}

/**
 * Alibaba-style large search menu.
 *
 * Client component with one piece of state: the highlighted category.
 * Hovering (or focusing) a left-list row swaps the right panel; the search
 * bar itself is a native GET form (same `/products?q=` + `page=1` contract
 * as `StorefrontSearchForm`), image search reuses `ImageSearchButton`, and
 * every category/trending entry links to a real route.
 */
export function SearchMegaMenu({
  categories,
  activeSlug,
  trending = [],
  query = "",
  suggestions = [],
  visibleCount = 6,
}: {
  categories: MegaMenuCategory[];
  activeSlug?: string;
  trending?: string[];
  query?: string;
  suggestions?: MegaMenuSuggestion[];
  visibleCount?: number;
}) {
  const initial =
    categories.find((c) => c.slug === activeSlug) ?? categories[0] ?? null;
  const [activeSlugState, setActiveSlugState] = useState<string | null>(
    initial?.slug ?? null,
  );
  // Live suggestions activate only after the user types, so the static
  // `suggestions` fallback (used by Storybook) keeps rendering untouched.
  const [value, setValue] = useState(query);
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const {
    products: liveProducts,
    categories: liveCategories,
    hasResults: liveHasResults,
  } = useSearchSuggestions(open && touched ? value : "");
  const showLive =
    touched && normalizeSuggestQuery(value).length >= SUGGEST_MIN_CHARS;
  const showLiveDropdown = open && showLive && liveHasResults;
  const showFallbackDropdown =
    !showLive && !showLiveDropdown && suggestions.length > 0;
  const active =
    categories.find((c) => c.slug === activeSlugState) ?? initial;
  const visible = categories.slice(0, visibleCount);
  const hasMore = categories.length > visible.length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-6">
      {/* One big panel holding every feature (visual only) */}
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex min-w-0 flex-col px-4 py-4 sm:px-5 sm:py-5 lg:pb-0">
          {/* Large search bar */}
          <div
            className="relative min-w-0"
            data-mini-search-anchor
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setOpen(false);
              }
            }}
          >
          <form
            action="/products"
            method="get"
            onSubmit={() => setOpen(false)}
            className="flex h-12 w-full min-w-0 items-stretch rounded-md border-2 border-primary bg-card"
          >
            <input type="hidden" name="page" value="1" />
            <div className="relative min-w-0 flex-1">
              <Input
                name="q"
                value={value}
                placeholder="Search products, suppliers..."
                autoComplete="off"
                aria-expanded={showLiveDropdown || showFallbackDropdown}
                aria-controls={listId}
                onChange={(e) => {
                  setValue(e.target.value);
                  setTouched(true);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                className="h-full min-w-0 rounded-none border-0 bg-transparent pl-3 pr-1 text-sm shadow-none focus-visible:ring-0 sm:pl-4"
              />
            </div>
            <span className="flex shrink-0 items-center pr-1 sm:pr-2">
              <ImageSearchButton />
            </span>
            <Button
              type="submit"
              aria-label="Search"
              className="h-full shrink-0 rounded-r-sm px-3 text-sm font-bold sm:px-8"
            >
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2.5} className="size-4" />
              <span className="max-sm:hidden">Search</span>
            </Button>
          </form>

          {/* Suggestion dropdown: live product + category matches once the
              user types, otherwise the static `suggestions` fallback. */}
          {showLiveDropdown && (
            <SearchSuggestionsDropdown
              products={liveProducts}
              categories={liveCategories}
              listId={listId}
              variant="hero"
            />
          )}
          {showFallbackDropdown && (
            <div id={listId} className="absolute inset-x-0 top-full z-50 overflow-hidden rounded-b-md border-2 border-t-0 border-primary bg-card shadow-md">
              <ul className="flex max-h-64 flex-col overflow-y-auto py-1">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/products?q=${encodeURIComponent(s.label)}`}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/85 hover:bg-muted"
                    >
                      <HugeiconsIcon
                        icon={Search01Icon}
                        strokeWidth={2}
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {s.label}
                      </span>
                      {s.hint && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {s.hint}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Hot searches: native horizontal chip scroller on mobile */}
        {trending.length > 0 && (
          <div className="mt-3 flex items-center gap-2 px-1">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
              Hot:
            </span>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto no-scrollbar snap-x py-0.5 lg:flex-wrap lg:overflow-visible">
              {trending.map((term) => (
                <Link
                  key={term}
                  href={`/products?q=${encodeURIComponent(term)}`}
                  className="inline-flex h-8 shrink-0 snap-start items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground/80 transition-colors active:bg-muted lg:h-auto lg:shrink lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:hover:text-primary lg:hover:underline"
                >
                  <span className="max-w-36 truncate">{term}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        </div>

        {/* Category browse: desktop-only hover grid (mobile uses bottom-nav Categories) */}
        <nav
          aria-label="Browse categories"
          className="mt-4 hidden overflow-hidden rounded-b-lg border-t border-border sm:mt-5 lg:grid lg:grid-cols-[260px_1fr]"
        >
          <div className="border-b border-border bg-muted/40 px-4 py-2.5">
            <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              All Categories
            </p>
          </div>
          <div className="border-b border-border bg-muted/40 px-4 py-2.5">
            <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {active ? active.name : "Sub-categories"}
            </p>
          </div>

          <ul className="flex flex-col">
            {visible.map((cat) => {
              const isActive = active?.slug === cat.slug;
              return (
                <li key={cat.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/category/${cat.slug}`}
                    aria-current={isActive ? "page" : undefined}
                    onMouseEnter={() => setActiveSlugState(cat.slug)}
                    onFocus={() => setActiveSlugState(cat.slug)}
                    className={
                      isActive
                        ? "flex items-center justify-between border-l-2 border-primary bg-background px-4 py-2.5 text-sm font-bold text-primary"
                        : "flex items-center justify-between border-l-2 border-transparent px-4 py-2.5 text-sm font-medium text-foreground/80"
                    }
                  >
                    <span className="truncate">{cat.name}</span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              );
            })}
            {hasMore && (
              <li className="border-t border-border">
                <Link
                  href="/categories"
                  className="flex items-center justify-between px-4 py-2.5 text-sm font-bold text-primary"
                >
                  <span className="truncate">
                    Show all {categories.length} categories
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2.5}
                    className="size-3.5 shrink-0"
                  />
                </Link>
              </li>
            )}
          </ul>

          <div className="bg-card px-4 py-4 sm:px-5 lg:border-l lg:border-border">
            {active ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-base font-bold tracking-tight">{active.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {active.product_count} product{active.product_count === 1 ? "" : "s"}
                  </span>
                </div>
                {active.subcategories.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {active.subcategories.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/category/${sub.slug}`}
                          className="flex items-center gap-2.5 rounded-sm border border-border bg-card px-2 py-1.5 text-sm font-medium text-foreground/80 hover:border-primary/40"
                        >
                          <SubThumb sub={sub} />
                          <span className="min-w-0 truncate hover:text-primary hover:underline">
                            {sub.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No sub-categories yet — suppliers haven&apos;t listed here.
                  </p>
                )}
                <Link
                  href={`/category/${active.slug}`}
                  className="text-sm font-semibold text-primary"
                >
                  View all {active.name} →
                </Link>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No categories yet
              </p>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
