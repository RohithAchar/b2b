import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  Building02Icon,
  Package01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { AttentionPanel, type AttentionItem } from "@/components/dashboard/attention-panel";
import { ProfileCompletionCard, profileChecklist } from "@/components/dashboard/profile-completion";
import { StatusBadge } from "@/components/dashboard/status-badge";

function logoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company_logos/${path}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SupplierOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, gst_certificate_path, pan_card_path, license_path, kyb_status, rejection_note, logo_path, submitted_at",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!company) {
    redirect("/supplier/onboarding");
  }

  const verified = company.kyb_status === "verified";

  // eslint-disable-next-line react-hooks/purity -- server component: per-request timestamp
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalCount }, { count: liveCount }, { count: pendingCount }, { count: rejectedCount }, { count: monthCount }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", company.id),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", company.id)
        .eq("status", "approved"),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", company.id)
        .eq("status", "pending"),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", company.id)
        .eq("status", "rejected"),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", company.id)
        .gte("created_at", thirtyDaysAgo),
    ]);

  const { data: recent } = await supabase
    .from("products")
    .select("id, title, price_per_unit, unit, moq, stock_qty, status, created_at")
    .eq("supplier_id", company.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const checklist = profileChecklist(company);
  const missingCount = checklist.items.filter((i) => !i.done).length;

  const attention: AttentionItem[] = [];
  if (company.kyb_status === "draft") {
    attention.push({
      id: "kyb-draft",
      title: "Finish your application",
      description: "Complete business details, IDs and documents to unlock selling.",
      severity: "error",
      href: "/supplier/onboarding",
      actionLabel: "Continue",
    });
  } else if (company.kyb_status === "rejected") {
    attention.push({
      id: "kyb-rejected",
      title: "Business application needs changes",
      description: company.rejection_note ?? "Review the note and resubmit your application.",
      severity: "error",
      href: "/supplier/onboarding",
      actionLabel: "Fix and resubmit",
    });
  } else if (company.kyb_status === "pending") {
    attention.push({
      id: "kyb-pending",
      title: "Verification under review",
      description: "Listing unlocks once our team verifies your business.",
      severity: "warning",
      href: "/supplier/dashboard/verification",
      actionLabel: "Track",
    });
  }

  if (verified && (rejectedCount ?? 0) > 0) {
    attention.push({
      id: "products-rejected",
      title: `${rejectedCount} product${rejectedCount === 1 ? "" : "s"} need changes`,
      description: "Fix the notes and resubmit for approval.",
      severity: "error",
      href: "/supplier/dashboard/products?tab=rejected",
      actionLabel: "Review",
    });
  }
  if (missingCount > 0) {
    attention.push({
      id: "profile",
      title: "Complete your business profile",
      description: `${missingCount} detail${missingCount === 1 ? "" : "s"} missing — buyers see this on your storefront.`,
      severity: "info",
      href: "/supplier/dashboard/business",
      actionLabel: "Complete",
    });
  }

  const kybTitle: Record<string, string> = {
    draft: "Start your application",
    pending: "Under review",
    verified: "You are verified",
    rejected: "Needs changes",
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {company.logo_path ? (
            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              <Image
                src={logoUrl(company.logo_path)}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:size-5">
              <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />
            </span>
          )}
          <div className="grid min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {company.business_name}
            </h1>
            <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
              <span className="truncate">{kybTitle[company.kyb_status] ?? company.kyb_status}</span>
              <StatusBadge status="kyb" value={company.kyb_status} />
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            render={<Link href="/products" />}
            nativeButton={false}
            variant="outline"
          >
            View marketplace
          </Button>
          {verified ? (
            <Button render={<Link href="/supplier/dashboard/products/new" />} nativeButton={false}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Add product
            </Button>
          ) : null}
        </div>
      </div>

      {company.kyb_status === "rejected" && company.rejection_note ? (
        <Alert variant="destructive">
          <AlertDescription>{company.rejection_note}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat
          label="Total products"
          value={totalCount ?? 0}
          caption={`${monthCount ?? 0} added this month`}
          icon={Package01Icon}
        />
        <KpiStat
          label="Live listings"
          value={liveCount ?? 0}
          caption={verified ? "Visible to buyers" : "Unlocks after verification"}
          icon={ShieldCheckIcon}
        />
        <KpiStat
          label="Awaiting review"
          value={pendingCount ?? 0}
          caption="With our moderation team"
        />
        <KpiStat
          label="Needs changes"
          value={rejectedCount ?? 0}
          caption="Fix and resubmit"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <AttentionPanel
          title="Needs attention"
          description="Actionable items for your business."
          items={attention}
          className="lg:col-span-4"
        />
        <div className="flex flex-col gap-4 lg:col-span-3">
          <ProfileCompletionCard score={checklist.score} items={checklist.items} />
        </div>
      </div>

      <Card className="!gap-0 !pb-0">
        <CardHeader className="flex w-full flex-row items-center justify-between border-b border-border gap-2">
          <div className="grid gap-0.5">
            <CardTitle>Recent products</CardTitle>
            <CardDescription>Your latest listings and their status.</CardDescription>
          </div>
          {verified ? (
            <Button
              render={<Link href="/supplier/dashboard/products" />}
              nativeButton={false}
              variant="outline"
              size="sm"
              className="[&_svg]:size-3.5"
            >
              View all
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="!px-0">
          {!recent || recent.length === 0 ? (
            <Empty className="!border-0">
              <EmptyTitle>No products yet</EmptyTitle>
              <EmptyDescription>
                {verified
                  ? "Create your first listing to start selling."
                  : "Products unlock once your business is verified."}
              </EmptyDescription>
              {verified ? (
                <Button
                  render={<Link href="/supplier/dashboard/products/new" />}
                  nativeButton={false}
                >
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                  Add product
                </Button>
              ) : null}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Price</TableHead>
                  <TableHead className="hidden md:table-cell">MOQ</TableHead>
                  <TableHead className="hidden md:table-cell">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/supplier/dashboard/products/${p.id}/edit`}
                        className="block max-w-64 truncate font-medium hover:underline"
                      >
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      ₹{Number(p.price_per_unit)} / {p.unit}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{p.moq}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{p.stock_qty}</TableCell>
                    <TableCell>
                      <StatusBadge status="product" value={p.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDate(p.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}