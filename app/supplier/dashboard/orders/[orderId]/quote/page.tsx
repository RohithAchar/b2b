import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { QuotationForm } from "./quotation-form";

export const metadata: Metadata = { title: "Send quotation" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderRow = { id: string; reference: string; status: string };

type ItemRow = {
  id: string;
  title: string;
  variant_label: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
};

export default async function SupplierQuotationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) {
    notFound();
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect(LOGIN_PATH);
  }

  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx) {
    redirect("/supplier/onboarding");
  }

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, reference, status")
      .eq("id", orderId)
      .eq("supplier_id", ctx.companyId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("id, title, variant_label, unit, quantity, unit_price")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);
  if (!order) {
    notFound();
  }

  const orderRow = order as OrderRow;
  if (orderRow.status !== "new" && orderRow.status !== "quoted") {
    redirect(`/supplier/dashboard/orders/${orderId}`);
  }

  const orderItems = (items ?? []) as unknown as ItemRow[];
  if (orderItems.length === 0) {
    redirect(`/supplier/dashboard/orders/${orderId}`);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            render={<Link href={`/supplier/dashboard/orders/${orderId}`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            Order
          </Button>
          <h1 className="text-xl font-bold tracking-tight">Send quotation</h1>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {orderRow.reference}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Confirm the real prices, delivery and tax for this order. The buyer
        reviews and accepts this version before anything is due. The original
        order totals stay unchanged.
      </p>

      <QuotationForm
        orderId={orderRow.id}
        items={orderItems.map((item) => ({
          orderItemId: item.id,
          title: item.title,
          variantLabel: item.variant_label,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
        }))}
      />
    </div>
  );
}
