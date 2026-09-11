import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/storage";
import { getHomepageData, getFeaturedSuppliers } from "@/lib/storefront";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { StorefrontFooter } from "@/components/layout/storefront-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type CoverImageProduct = { images: { path: string; sort: number }[] | null };
type PriceProduct = { price_per_unit: number; unit: string };

function productCoverUrl(product: CoverImageProduct): string {
  const images = product.images;
  if (!images || images.length === 0) return "/placeholder.png";
  const sorted = [...images].sort((a, b) => a.sort - b.sort);
  return publicImageUrl("product_images", sorted[0].path);
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader
        user={user ? { email: user.email!, user_type: userType ?? "buyer" } : null}
      />

      <main className="flex-1">
        {/* Hero banner placeholder */}
        <section className="mx-auto max-w-7xl px-4 pt-6">
          <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20">
            <span className="text-sm text-muted-foreground">Banner placeholder (1200 x 256)</span>
          </div>
        </section>

        {/* Search bar */}
        <section className="mx-auto max-w-7xl px-4 py-6">
          <form action="/products" method="get" className="flex gap-2">
            <input type="hidden" name="page" value="1" />
            <div className="relative flex-1">
              <input
                type="text"
                name="q"
                placeholder="Search products..."
                className="h-10 w-full rounded-lg border border-input bg-input/30 px-4 pr-10 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <Button type="submit" className="h-10 px-6">
              Search
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.slice(0, 8).map((cat) => (
              <Link key={cat.id} href={`/category/${cat.slug}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-muted">
                  {cat.name}
                </Badge>
              </Link>
            ))}
          </div>
        </section>

        {/* Category grid */}
        <section className="mx-auto max-w-7xl px-4 pb-8">
          <h2 className="mb-4 text-lg font-semibold">Browse Categories</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/category/${cat.slug}`}>
                <Card className="group overflow-hidden transition-shadow hover:shadow-md">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                    {cat.image_path ? (
                      <img
                        src={publicImageUrl("category_images", cat.image_path)}
                        alt={cat.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
                      {cat.product_count} products
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Promotional banner placeholder */}
        <section className="mx-auto max-w-7xl px-4 pb-8">
          <div className="flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20">
            <span className="text-sm text-muted-foreground">Promotional banner placeholder</span>
          </div>
        </section>

        <Separator className="mx-auto max-w-7xl" />

        {/* New arrivals */}
        <section className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">New Arrivals</h2>
            <Link href="/products">
              <Button variant="ghost" size="sm">
                View all →
              </Button>
            </Link>
          </div>
          {products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No products available yet.
            </p>
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
                          {formatPrice((product as PriceProduct).price_per_unit)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            / {(product as PriceProduct).unit}
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
        </section>

        <Separator className="mx-auto max-w-7xl" />

        {/* Featured suppliers */}
        {featuredSuppliers.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-8">
            <h2 className="mb-4 text-lg font-semibold">Featured Suppliers</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {featuredSuppliers.map((supplier) => (
                <Card key={supplier.id} className="overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    {supplier.logo_path ? (
                      <img
                        src={publicImageUrl("company_logos", supplier.logo_path)}
                        alt={supplier.business_name}
                        className="size-10 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium">
                        {supplier.business_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {supplier.business_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {supplier.city}, {supplier.state}
                      </p>
                    </div>
                  </div>
                  {supplier.product_images.length > 0 && (
                    <div className="flex gap-1 p-2">
                      {supplier.product_images.slice(0, 3).map((path, i) => (
                        <div key={i} className="aspect-square flex-1 overflow-hidden rounded-lg bg-muted">
                          <img
                            src={publicImageUrl("product_images", path)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
}
