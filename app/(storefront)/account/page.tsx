import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { AccountTabs } from "./account-tabs";
import { EnquiriesTab } from "./enquiries-tab";
import { SavedTab } from "./saved-tab";
import { RecentTab } from "./recent-tab";
import { TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your enquiries, saved products, and recently viewed items.",
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
  const activeTab = tab ?? "enquiries";

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
        ) : activeTab === "recent" ? (
          <TabsContent value="recent">
            <RecentTab />
          </TabsContent>
        ) : (
          <TabsContent value="enquiries">
            <EnquiriesTab />
          </TabsContent>
        )}
      </AccountTabs>
    </div>
  );
}
