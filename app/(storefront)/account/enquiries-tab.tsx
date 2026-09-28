import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getBuyerEnquiries } from "@/lib/buyer/queries";
import { Card } from "@/components/ui/card";
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "quoted"
      ? "success"
      : status === "closed"
        ? "secondary"
        : "warning";
  return <Badge variant={variant as "success" | "secondary" | "warning"}>{status}</Badge>;
}

export async function EnquiriesTab() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) return null;

  const { enquiries, total, page, totalPages } = await getBuyerEnquiries(
    supabase,
    user.id,
  );

  if (enquiries.length === 0) {
    return (
      <div className="py-16">
        <Empty>
          <EmptyTitle>No enquiries yet</EmptyTitle>
          <EmptyDescription>
            Browse products and send an enquiry to get started.
          </EmptyDescription>
          <Link href="/products">
            <Button className="mt-3">Browse Products</Button>
          </Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{total}</span> enquiry
        {total !== 1 ? "s" : ""}
      </p>
      {enquiries.map((enquiry) => (
        <Card key={enquiry.id} className="rounded-lg p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {enquiry.product ? (
                <Link
                  href={`/products/${enquiry.product.id}`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {enquiry.product.title}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">
                  Product no longer available
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {enquiry.supplier?.business_name ?? "Unknown supplier"}
                {enquiry.supplier?.city && ` · ${enquiry.supplier.city}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={enquiry.status} />
                {enquiry.quantity != null && (
                  <span className="text-xs text-muted-foreground">
                    Qty: {enquiry.quantity}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDate(enquiry.created_at)}
                </span>
              </div>
              {enquiry.message && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {enquiry.message}
                </p>
              )}
            </div>
            {enquiry.product && (
              <Link href={`/products/${enquiry.product.id}`}>
                <Button variant="outline" size="sm">
                  View Product
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ))}
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious
                    href={`/account?tab=enquiries&page=${page - 1}`}
                  />
                </PaginationItem>
              )}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href={`/account?tab=enquiries&page=${p}`}
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
                    href={`/account?tab=enquiries&page=${page + 1}`}
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
