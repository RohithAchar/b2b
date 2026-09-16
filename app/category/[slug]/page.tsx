import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/storage";
import { getCategoryBySlug } from "@/lib/storefront";
import { getProducts } from "@/lib/storefront";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { StorefrontFooter } from "@/components/layout/storefront-footer";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

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

  const category = await getCategoryBySlug(supabase, slug);
  if (!category) notFound();

  const { products, total, totalPages } = await getProducts(supabase, {
    categorySlug: slug,
    page,
    perPage: 24,
  });

  function buildPageUrl(p: number) {
    return `/category/${slug}?page=${p}`;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader
        user={user ? { email: user.email!, user_type: userType ?? "buyer" } : null}
      />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: category.name }]}
          />

          {/* Category header */}
          <div className="mb-6 flex items-center gap-4">
            {category.image_path && (
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                <Image
                  src={publicImageUrl("category_images", category.image_path)}
                  alt={category.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{category.name}</h1>
              <p className="text-sm text-muted-foreground">
                {total} product{total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Subcategories */}
          {category.subcategories.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {category.subcategories.map((sub) => (
                <Link key={sub.id} href={`/category/${sub.slug}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-muted">
                    {sub.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Product grid */}
          {products.length === 0 ? (
            <div className="py-16">
              <Empty>
                <EmptyTitle>No products in this category yet</EmptyTitle>
                <EmptyDescription>
                  Suppliers haven&apos;t listed products here yet.
                </EmptyDescription>
                <Link href="/products">
                  <Button variant="outline" size="sm" className="mt-3">
                    Browse all products
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