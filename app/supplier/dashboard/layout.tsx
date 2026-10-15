import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const [{ data: profile }, { data: company }] = await Promise.all([
    supabase.from("profiles").select("user_type").eq("id", user.id).maybeSingle(),
    supabase.from("companies").select("business_name, kyb_status").eq("owner_id", user.id).maybeSingle(),
  ]);

  if (profile?.user_type !== "supplier") {
    redirect("/");
  }

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
