import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { getAccountStoreIds } from "@/lib/supplier/account-stores";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";

const COMING_SOON_STORES = ["d2h-select", "ecom-package", "dropshopping"];

export default async function ComingSoonStorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    redirect("/auth/login");
  }

  const storeIds = await getAccountStoreIds();
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, slug, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!store || store.status !== "active") {
    notFound();
  }

  // D2H Core has its own dashboard; this route is only for the coming-soon
  // stores. Anything else falls back to the main dashboard.
  if (!COMING_SOON_STORES.includes(slug)) {
    redirect("/supplier/dashboard");
  }

  // The account must have access to this store.
  if (!storeIds.includes(store.id)) {
    redirect("/supplier/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>{store.name}</CardTitle>
          <CardDescription>Coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyTitle>Dashboard not available yet</EmptyTitle>
            <EmptyDescription>
              The {store.name} dashboard is coming soon. Switch back to D2H
              Core from the store switcher to manage your products.
            </EmptyDescription>
          </Empty>
          <div className="mt-6 flex justify-end">
            <Button
              render={<Link href="/supplier/dashboard" />}
              nativeButton={false}
            >
              Back to D2H Core
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
