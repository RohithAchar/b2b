import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getAuthUser } from "@/lib/auth/session";
import { resolveStore } from "@/lib/store-context";
import { STORE_COOKIE_NAME } from "@/lib/store-context-types";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { TopBar } from "@/components/dashboard/top-bar";
import { SupplierSidebar } from "./sidebar";
import { DashboardStoreSelector } from "@/components/dashboard/dashboard-store-selector";
import { getAccountStores } from "@/lib/supplier/account-stores";

// Private workspace: never indexed.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SupplierDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const cookieStore = await cookies();
  const storeId = cookieStore.get(STORE_COOKIE_NAME)?.value ?? null;

  const [{ data: profile }, accountStores, activeStore] = await Promise.all([
    supabase.from("profiles").select("user_type").eq("id", user.id).maybeSingle(),
    getAccountStores(),
    resolveStore(supabase, storeId),
  ]);

  let userType = profile?.user_type;

  // An account linked to stores is a supplier. Promote buyer->supplier on
  // first dashboard visit (an allowed self-transition per
  // internal.prevent_role_escalation).
  if (accountStores.length > 0 && userType === "buyer") {
    const { error: promoteError } = await supabase
      .from("profiles")
      .update({ user_type: "supplier" })
      .eq("id", user.id);
    if (!promoteError) userType = "supplier";
  }

  // Buyers without store access have no place in the supplier workspace.
  if (userType === "buyer") {
    redirect("/");
  }

  return (
    <SidebarProvider>
      <Suspense>
        <SupplierSidebar
          user={{
            name: profile?.user_type === "admin" ? "Admin" : "Supplier",
            email: user.email ?? "",
          }}
          kybStatus="verified"
          isStaff={userType === "staff"}
        />
      </Suspense>
      <SidebarInset className="@container/content">
        <Header>
          <TopBar
            title="Supplier dashboard"
            actions={
              <DashboardStoreSelector
                stores={accountStores}
                selectedStoreId={activeStore?.id ?? null}
              />
            }
          />
        </Header>
        <Main>{children}</Main>
      </SidebarInset>
    </SidebarProvider>
  );
}
