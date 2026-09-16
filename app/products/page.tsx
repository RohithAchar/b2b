import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProducts } from "@/lib/storefront";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { StorefrontFooter } from "@/components/layout/storefront-footer";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const categorySlug = params.category ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

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

  const { products, total, totalPages } = await getProducts(supabase, {
    query,
    categorySlug,
    page,
    perPage: 24,
  });

  // Fetch categories for filter chips.
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order")
    .order("name");

  function buildPageUrl(p: number) {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (categorySlug) sp.set("category", categorySlug);
    sp.set("page", String(p));
    return `/products?${sp.toString()}`;
  }

  function buildCategoryLink(slug: string) {
    const sp = new URLSearchParams();
    sp.set("category", slug);
    if (query) sp.set("q", query);
    return `/products?${sp.toString()}`;
  }

  const activeFilter = categorySlug
    ? (categories ?? []).find((c) => c.slug === categorySlug)?.name
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader
        user={user ? { email: user.email!, user_type: userType ?? "buyer" } : null}
      />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Products" }]} />

          {/* Search + filters */}
          <div className="mb-6 flex flex-col gap-3">
            <form action="/products" method="get" className="flex gap-2">
              {categorySlug && (
                <input type="hidden" name="category" value={categorySlug} />
              )}
              <input type="hidden" name="page" value="1" />
              <div className="relative flex-1">
                <Input
                  name="q"
                  defaultValue={query}
                  placeholder="Search products..."
                  className="h-9 pr-9"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
                </span>
              </div>
              <Button type="submit" size="sm">
                Search
              </Button>
            </form>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={query ? `/products?q=${encodeURIComponent(query)}` : "/products"}
              >
                <Badge variant={categorySlug ? "secondary" : "default"}>All</Badge>
              </Link>
              {(categories ?? []).map((cat) => (
                <Link key={cat.id} href={buildCategoryLink(cat.slug)}>
                  <Badge variant={categorySlug === cat.slug ? "default" : "secondary"}>
                    {cat.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>

          {/* Results meta */}
          <div className="mb-4 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-muted-foreground">
              {total} product{total !== 1 ? "s" : ""} found
              {query && <> for &ldquo;{query}&rdquo;</>}
            </p>
            {activeFilter && (
              <Badge variant="secondary">
                {activeFilter}
                <Link
                  aria-label={`Remove ${activeFilter} filter`}
                  href={
                    query
                      ? `/products?q=${encodeURIComponent(query)}`
                      : "/products"
                  }
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </Link>
              </Badge>
            )}
          </div>

          {/* Product grid */}
          {products.length === 0 ? (
            <div className="py-16">
              <Empty>
                <EmptyTitle>No products found</EmptyTitle>
                <EmptyDescription>
                  Try a different search or clear the filters.
                </EmptyDescription>
                <Link href="/products">
                  <Button variant="outline" size="sm" className="mt-3">
                    Clear filters
                  </Button>
                </Link>
              </Empty>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product as ProductCardData} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination>
                <PaginationContent>
                  {page > 1 && (
                    <PaginationItem>
                      <PaginationPrevious href={buildPageUrl(page - 1)} />
                    </PaginationItem>
                  )}
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <PaginationItem key={p}>
                        <PaginationLink href={buildPageUrl(p)} isActive={p === page}>
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  {page < totalPages && (
                    <PaginationItem>
                      <PaginationNext href={buildPageUrl(page + 1)} />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
}