"use client";

import { useState } from "react";
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
  const active =
    categories.find((c) => c.slug === activeSlugState) ?? initial;
  const visible = categories.slice(0, visibleCount);
  const hasMore = categories.length > visible.length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* One big panel holding every feature (visual only) */}
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex flex-col px-5 pt-5">
          {/* Large search bar */}
          <div className="relative">
          <form
            action="/products"
            method="get"
            className="flex h-12 w-full items-stretch rounded-md border-2 border-primary bg-card"
          >
            <input type="hidden" name="page" value="1" />
            <div className="relative flex-1">
              <Input
                name="q"
                defaultValue={query}
                placeholder="Search products, suppliers, manufacturers..."
                className="h-full rounded-none border-0 bg-transparent pl-4 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
            <span className="flex items-center pr-2">
              <ImageSearchButton />
            </span>
            <Button
              type="submit"
              className="h-full shrink-0 rounded-r-sm px-8 text-sm font-bold"
            >
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2.5} className="size-4" />
              Search
            </Button>
          </form>

          {/* Suggestion dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute inset-x-0 top-full z-50 overflow-hidden rounded-b-md border-2 border-t-0 border-primary bg-card shadow-md">
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

        {/* Hot searches */}
        {trending.length > 0 && (
          <p className="mt-2 truncate px-1 text-xs text-muted-foreground">
            <span className="font-semibold">Hot: </span>
            {trending.map((term, i) => (
              <span key={term}>
                {i > 0 && <span className="mx-1.5 text-border">|</span>}
                <Link
                  href={`/products?q=${encodeURIComponent(term)}`}
                  className="hover:text-primary hover:underline"
                >
                  {term}
                </Link>
              </span>
            ))}
          </p>
        )}
        </div>

        {/* Category browse section, divided from the search block above */}
        <nav
          aria-label="Browse categories"
          className="mt-5 grid overflow-hidden rounded-b-lg border-t border-border lg:grid-cols-[260px_1fr]"
        >
          <div className="border-b border-border bg-muted/40 px-4 py-2.5 max-lg:hidden">
            <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              All Categories
            </p>
          </div>
          <div className="border-b border-border bg-muted/40 px-4 py-2.5">
            <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {active ? active.name : "Sub-categories"}
            </p>
          </div>

          <ul className="flex flex-col max-lg:hidden">
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

          <div className="bg-card px-5 py-4 lg:border-l lg:border-border">
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
