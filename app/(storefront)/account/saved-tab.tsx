import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getBuyerSavedProducts } from "@/lib/buyer/queries";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { UnsaveButton } from "./unsave-button";

export async function SavedTab() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) return null;

  const { products, total, page, totalPages } = await getBuyerSavedProducts(
    supabase,
    user.id,
  );

  if (products.length === 0) {
    return (
      <div className="py-16">
        <Empty>
          <EmptyTitle>No saved products</EmptyTitle>
          <EmptyDescription>
            Save products you are interested in to find them quickly later.
          </EmptyDescription>
          <Link href="/products">
            <Button className="mt-3">Browse Products</Button>
          </Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{total}</span> saved
        product{total !== 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {products.map((product) => (
          <div key={product.id} className="relative">
            <ProductCard product={product as ProductCardData} />
            <UnsaveButton productId={product.id} title={product.title} />
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious
                    href={`/account?tab=saved&page=${page - 1}`}
                  />
                </PaginationItem>
              )}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href={`/account?tab=saved&page=${p}`}
                      isActive={p === page}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              {page < totalPages && (
                <PaginationItem>
                  <PaginationNext
                    href={`/account?tab=saved&page=${page + 1}`}
                  />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
