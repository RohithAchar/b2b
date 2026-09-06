"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AdminSidebar({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queueActive =
    pathname.startsWith("/admin/dashboard/supplier-verification") &&
    (searchParams.get("tab") ?? "pending") === "pending";
  const overviewActive =
    pathname === "/admin/dashboard" || pathname === "/admin/dashboard/";
  const categoriesActive = pathname.startsWith(
    "/admin/dashboard/categories",
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <span className="px-2 text-sm font-medium">Review desk</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Supplier applications</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/admin/dashboard" />}
                  isActive={overviewActive}
                >
                  Overview
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/dashboard/supplier-verification" />
                  }
                  isActive={queueActive}
                >
                  Supplier verification
                </SidebarMenuButton>
                {pendingCount > 0 ? (
                  <SidebarMenuBadge>{pendingCount}</SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Catalog</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/admin/dashboard/categories" />}
                  isActive={categoriesActive}
                >
                  Categories
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" />}>
              Back to site
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
