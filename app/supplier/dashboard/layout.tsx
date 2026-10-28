import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getAuthUser } from "@/lib/auth/session";
import { getSupplierContext } from "@/lib/auth/guard";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { TopBar } from "@/components/dashboard/top-bar";
import { SupplierSidebar } from "./sidebar";

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

  const [{ data: profile }, ctx] = await Promise.all([
    supabase.from("profiles").select("user_type").eq("id", user.id).maybeSingle(),
    getSupplierContext(supabase, user.id),
  ]);

  let userType = profile?.user_type;
  // Staff usually join with a buyer account. Promote on first dashboard
  // visit: this is the trigger-allowed *self* buyer->supplier transition (an
  // owner cannot flip another user: profiles RLS + prevent_role_escalation
  // block cross-user changes).
  if (ctx?.role === "staff" && userType === "buyer") {
    const { error: promoteError } = await supabase
      .from("profiles")
      .update({ user_type: "supplier" })
      .eq("id", user.id);
    if (!promoteError) userType = "supplier";
  }

  if (userType !== "supplier" && ctx?.role !== "staff") {
    redirect("/");
  }

  const { data: company } = ctx
    ? await supabase
        .from("companies")
        .select("business_name, kyb_status")
        .eq("id", ctx.companyId)
        .maybeSingle()
    : { data: null };

  return (
    <SidebarProvider>
      <Suspense>
        <SupplierSidebar
          user={{
            name: company?.business_name ?? "Supplier",
            email: user.email ?? "",
          }}
          kybStatus={company?.kyb_status ?? "draft"}
          isStaff={ctx?.role === "staff"}
        />
      </Suspense>
      <SidebarInset className="@container/content">
        <Header>
          <TopBar title="Supplier dashboard" />
        </Header>
        <Main>{children}</Main>
      </SidebarInset>
    </SidebarProvider>
  );
}
