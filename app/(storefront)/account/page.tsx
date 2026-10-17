import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getBuyerAddresses } from "@/lib/buyer/address-queries";
import { AccountTabs } from "./account-tabs";
import { SavedTab } from "./saved-tab";
import { RecentTab } from "./recent-tab";
import { AddressesTab } from "./addresses-tab";
import { TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your saved products, recently viewed items and delivery addresses.",
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

  // Addresses are only needed for their tab; the localStorage phone is a
  // convenience prefill, never a trusted or persisted source on its own.
  const addresses =
    activeTab === "addresses" ? await getBuyerAddresses(supabase, user.id) : [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <h1 className="text-xl font-bold tracking-tight md:text-2xl">My Account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user.email}
      </p>
      <AccountTabs activeTab={activeTab}>
        {activeTab === "saved" ? (
          <TabsContent value="saved">
            <SavedTab />
          </TabsContent>
        ) : activeTab === "addresses" ? (
          <TabsContent value="addresses">
            <AddressesTab addresses={addresses} />
          </TabsContent>
        ) : (
          <TabsContent value="recent">
            <RecentTab />
          </TabsContent>
        )}
      </AccountTabs>
    </div>
  );
}
