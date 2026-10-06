import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Camera01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * Static Alibaba-style large search menu (visual only).
 *
 * No client logic: no form action, no router, no state, no data fetching.
 * The active category panel is driven by the `activeSlug` prop and the
 * suggestion dropdown by the `suggestions` prop, so stories can showcase
 * each state without interactivity.
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
  const active =
    categories.find((c) => c.slug === activeSlug) ?? categories[0] ?? null;
  const visible = categories.slice(0, visibleCount);
  const hasMore = categories.length > visible.length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* One big panel holding every feature (visual only) */}
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex flex-col px-5 pt-5">
          {/* Large search bar (visual only) */}
          <div className="relative">
          <div className="flex h-12 w-full items-stretch overflow-hidden rounded-md border-2 border-primary bg-card">
            <div className="relative flex-1">
              <Input
                readOnly
                tabIndex={-1}
                defaultValue={query}
                placeholder="Search products, suppliers, manufacturers..."
                className="h-full rounded-none border-0 bg-transparent pl-4 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
            <span className="flex items-center pr-2 text-muted-foreground">
              <span className="flex size-8 items-center justify-center rounded-sm border border-border bg-muted/50">
                <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-4" />
              </span>
            </span>
            <Button
              type="button"
              tabIndex={-1}
              className="h-full shrink-0 rounded-none px-8 text-sm font-bold"
            >
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2.5} className="size-4" />
              Search
            </Button>
          </div>

          {/* Suggestion dropdown (visual only) */}
          {suggestions.length > 0 && (
            <div className="absolute inset-x-0 top-full z-50 overflow-hidden rounded-b-md border-2 border-t-0 border-primary bg-card shadow-md">
              <ul className="flex max-h-64 flex-col overflow-y-auto py-1">
                {suggestions.map((s) => (
                  <li key={s.id}>
                      <span className="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm text-foreground/85">
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
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Hot searches (visual only) */}
        {trending.length > 0 && (
          <p className="mt-2 truncate px-1 text-xs text-muted-foreground">
            <span className="font-semibold">Hot: </span>
            {trending.map((term, i) => (
              <span key={term}>
                {i > 0 && <span className="mx-1.5 text-border">|</span>}
                <span className="cursor-pointer hover:text-primary hover:underline">{term}</span>
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
                  <span
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "flex cursor-pointer items-center justify-between border-l-2 border-primary bg-background px-4 py-2.5 text-sm font-bold text-primary"
                        : "flex cursor-pointer items-center justify-between border-l-2 border-transparent px-4 py-2.5 text-sm font-medium text-foreground/80"
                    }
                  >
                    <span className="truncate">{cat.name}</span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  </span>
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

          <div className="bg-background px-5 py-4">
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
                        <span className="flex cursor-pointer items-center gap-2.5 rounded-sm border border-border bg-card px-2 py-1.5 text-sm font-medium text-foreground/80 hover:border-primary/40">
                          <SubThumb sub={sub} />
                          <span className="min-w-0 truncate hover:text-primary hover:underline">
                            {sub.name}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No sub-categories yet — suppliers haven&apos;t listed here.
                  </p>
                )}
                <span className="cursor-pointer text-sm font-semibold text-primary">
                  View all {active.name} →
                </span>
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
