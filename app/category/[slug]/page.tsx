import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/storage";
import { getCategoryBySlug } from "@/lib/storefront";
import { getProducts } from "@/lib/storefront";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { StorefrontFooter } from "@/components/layout/storefront-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

function productCoverUrl(product: { images: unknown }): string {
  const images = product.images as { path: string; sort: number }[];
  if (!images || images.length === 0) return "/placeholder.png";
  const sorted = [...images].sort((a, b) => a.sort - b.sort);
  return publicImageUrl("product_images", sorted[0].path);
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

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
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Breadcrumb */}
          <nav className="mb-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span className="mx-1">/</span>
            <span className="text-foreground">{category.name}</span>
          </nav>

          {/* Category header */}
          <div className="mb-6 flex items-center gap-4">
            {category.image_path && (
              <img
                src={publicImageUrl("category_images", category.image_path)}
                alt={category.name}
                className="size-16 shrink-0 rounded-xl border border-border object-cover"
              />
            )}
            <div>
              <h1 className="text-xl font-semibold">{category.name}</h1>
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
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No products in this category yet.
              </p>
              <Link href="/products">
                <Button variant="outline" size="sm" className="mt-3">
                  Browse all products
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {products.map((product) => {
                const supplier = product.supplier as { business_name?: string } | null;
                return (
                  <Link key={product.id} href={`/products/${product.id}`}>
                    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
                      <div className="aspect-square w-full overflow-hidden bg-muted">
                        <img
                          src={productCoverUrl(product)}
                          alt={product.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                      <div className="flex flex-col gap-1 px-3 py-2">
                        <p className="line-clamp-1 text-sm font-medium">
                          {product.title}
                        </p>
                        <p className="text-sm font-semibold">
                          {formatPrice(product.price_per_unit)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            / {product.unit}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          MOQ: {product.moq}+
                        </p>
                        {supplier && (
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {supplier.business_name}
                          </p>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
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
                        <PaginationLink
                          href={buildPageUrl(p)}
                          isActive={p === page}
                        >
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
