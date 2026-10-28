import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getBuyerAddresses } from "@/lib/buyer/address-queries";
import {
  AccountTabSkeleton,
  AddressListSkeleton,
} from "@/components/storefront/skeletons";
import { AccountTabs } from "./account-tabs";
import { SavedTab } from "./saved-tab";
import { RecentTab } from "./recent-tab";
import { AddressesTab } from "./addresses-tab";
import { TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your saved products, recently viewed items and delivery addresses.",
  robots: { index: false, follow: false },
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect("/auth/login?next=/account");
  }

  const { tab } = await searchParams;
  const activeTab = tab ?? "saved";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <h1 className="text-xl font-bold tracking-tight md:text-2xl">My Account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user.email}
      </p>
      <AccountTabs activeTab={activeTab}>
        {activeTab === "saved" ? (
          <TabsContent value="saved">
            {/* The tab's products stream in; the account header never waits
                for buyer-specific reads. */}
            <Suspense fallback={<AccountTabSkeleton />}>
              <SavedTab />
            </Suspense>
          </TabsContent>
        ) : activeTab === "addresses" ? (
          <TabsContent value="addresses">
            <Suspense fallback={<AddressListSkeleton />}>
              <AddressesSection userId={user.id} />
            </Suspense>
          </TabsContent>
        ) : (
          <TabsContent value="recent">
            <Suspense fallback={<AccountTabSkeleton />}>
              <RecentTab />
            </Suspense>
          </TabsContent>
        )}
      </AccountTabs>
    </div>
  );
}

async function AddressesSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const addresses = await getBuyerAddresses(supabase, userId);
  return <AddressesTab addresses={addresses} />;
}
