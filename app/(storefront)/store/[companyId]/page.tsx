import { cache } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building02Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  ProductCard,
  type ProductCardData,
} from "@/components/storefront/product-card";
import { createClient } from "@/lib/supabase/server";
import { fetchCustomerPriceMap } from "@/lib/storefront";
import { publicTransformedImageUrl } from "@/lib/storage";

type StorePageProps = {
  params: Promise<{ companyId: string }>;
};

type SupplierRow = {
  id: string;
  business_name: string;
  city: string;
  state: string;
  logo_path: string | null;
};

/**
 * Metadata and the page both need the supplier row; `cache` keeps that to one
 * query per request.
 */
const getStorefrontSupplier = cache(async (companyId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("storefront_suppliers")
    .select("id, business_name, city, state, logo_path")
    .eq("id", companyId)
    .maybeSingle();
  return (data as SupplierRow | null) ?? null;
});

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { companyId } = await params;
  const store = await getStorefrontSupplier(companyId);
  if (!store) return {};
  const location = [store.city, store.state].filter(Boolean).join(", ");
  const title = `${store.business_name} — Verified Supplier Store`;
  return {
    title,
    description: `Shop wholesale products from ${store.business_name}${location ? `, ${location}` : ""} — a verified supplier with live pricing and MOQs.`,
    alternates: { canonical: `/store/${companyId}` },
    openGraph: {
      title,
      description: `Shop wholesale products from ${store.business_name}${location ? `, ${location}` : ""} — a verified supplier with live pricing and MOQs.`,
      url: `/store/${companyId}`,
      type: "website",
    },
  };
}

type ProductRow = {
  id: string;
  title: string;
  unit: string;
  moq: number;
  negotiable: boolean;
  images: { path: string; sort: number }[] | null;
};

export default async function SupplierStorePage({ params }: StorePageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  // Public, verified-only projection — no PAN/GSTIN/bank columns exposed. The
  // product query keys off `companyId` too, so both run together.
  const [store, { data: products }] = await Promise.all([
    getStorefrontSupplier(companyId),
    supabase
      .from("products")
      .select("id, title, unit, moq, negotiable, images:product_images(path, sort)")
      .eq("supplier_id", companyId)
      .eq("status", "approved")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(48),
  ]);

  if (!store) {
    notFound();
  }

  const rows = (products ?? []) as ProductRow[];
  const priceMap = await fetchCustomerPriceMap(
    supabase,
    rows.map((p) => p.id),
  );

  const location = [store.city, store.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: store.business_name }]} />

      <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        {store.logo_path ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            <Image
              src={publicTransformedImageUrl("company_logos", store.logo_path, {
                width: 112,
              })}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:size-6">
            <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />
          </span>
        )}
        <div className="grid min-w-0 gap-1">
          <h1 className="truncate text-xl font-bold tracking-tight">
            {store.business_name}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="success">
              <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />
              Verified supplier
              <span className="sr-only">Verified supplier</span>
            </Badge>
            {location ? <span className="truncate">{location}</span> : null}
          </p>
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-base font-bold tracking-tight">
        All products
        <span className="ml-2 font-normal text-muted-foreground tabular-nums">
          {rows.length}
        </span>
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          This supplier hasn&apos;t listed any products yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((p, index) => {
            const card: ProductCardData = {
              id: p.id,
              title: p.title,
              unit: p.unit,
              moq: p.moq,
              negotiable: p.negotiable,
              images: p.images,
              pricing: priceMap.get(p.id) ?? null,
              supplier: {
                business_name: store.business_name,
                city: store.city,
                state: store.state,
                logo_path: store.logo_path,
              },
            };
            return (
              <ProductCard
                key={p.id}
                product={card}
                priority={index === 0}
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
