import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { ProductRowButtons } from "./row-buttons";

const STATUS_BADGE: Record<string, { label: string; variant: "secondary" | "default" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  pending: { label: "Under review", variant: "secondary" },
  approved: { label: "Live", variant: "default" },
  rejected: { label: "Needs changes", variant: "destructive" },
};

export default async function SupplierProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const { data: company } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!company) redirect("/supplier/onboarding");

  const { data: products } = await supabase
    .from("products")
    .select("id, title, price_per_unit, unit, moq, stock_qty, status, rejection_note, created_at")
    .eq("supplier_id", company.id)
    .order("created_at", { ascending: false });

  const verified = company.kyb_status === "verified";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {verified
              ? "List products with MOQ, images and variants. Submit drafts for approval."
              : "Product tools unlock once your business is verified."}
          </CardDescription>
          <CardAction>
            {verified ? (
              <Button
                render={<Link href="/supplier/dashboard/products/new" />}
                nativeButton={false}
              >
                Add product
              </Button>
            ) : (
              <Badge variant="outline">Locked</Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {!products || products.length === 0 ? (
            <Empty>
              <EmptyTitle>No products yet</EmptyTitle>
              <EmptyDescription>
                Create your first draft to get started.
              </EmptyDescription>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>MOQ</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const s = STATUS_BADGE[p.status] ?? STATUS_BADGE.draft;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{p.title}</span>
                          {p.status === "rejected" && p.rejection_note ? (
                            <span className="text-xs text-destructive">
                              {p.rejection_note}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        ₹{Number(p.price_per_unit)} / {p.unit}
                      </TableCell>
                      <TableCell className="tabular-nums">{p.moq}</TableCell>
                      <TableCell className="tabular-nums">
                        {p.stock_qty}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <ButtonGroup>
                          <Button
                            render={
                              <Link
                                href={`/supplier/dashboard/products/${p.id}/edit`}
                              />
                            }
                            nativeButton={false}
                            variant="outline"
                            size="sm"
                          >
                            Edit
                          </Button>
                          <ProductRowButtons
                            productId={p.id}
                            status={p.status}
                            verified={verified}
                          />
                        </ButtonGroup>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
