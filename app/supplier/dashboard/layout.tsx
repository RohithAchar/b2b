import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { TopBar } from "@/components/dashboard/top-bar";
import { SupplierSidebar } from "./sidebar";

export default async function SupplierDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.user_type !== "supplier") {
    redirect("/");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("business_name, kyb_status")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (
    <SidebarProvider>
      <Suspense>
        <SupplierSidebar
          user={{
            name: company?.business_name ?? "Supplier",
            email: user.email ?? "",
          }}
          kybStatus={company?.kyb_status ?? "draft"}
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
