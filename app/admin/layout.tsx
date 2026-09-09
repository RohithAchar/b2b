import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { AdminSidebar } from "./sidebar";

export default async function AdminLayout({
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

  if (profile?.user_type !== "admin") {
    redirect("/");
  }

  const { count: pendingCount } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("kyb_status", "pending");

  return (
    <SidebarProvider>
      <Suspense>
        <AdminSidebar
          pendingCount={pendingCount ?? 0}
          user={{ name: "Admin", email: user.email ?? "" }}
        />
      </Suspense>
      <SidebarInset className="@container/content">
        <Header>
          <span className="text-sm font-medium">Review desk</span>
        </Header>
        <Main>{children}</Main>
      </SidebarInset>
    </SidebarProvider>
  );
}
