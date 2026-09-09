"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  LayoutDashboardIcon,
  Package01Icon,
  SaleTag01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/layout/nav-user";

export function AdminSidebar({
  pendingCount,
  user,
}: {
  pendingCount: number;
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queueActive =
    pathname.startsWith("/admin/dashboard/supplier-verification") &&
    (searchParams.get("tab") ?? "pending") === "pending";
  const overviewActive =
    pathname === "/admin/dashboard" || pathname === "/admin/dashboard/";
  const categoriesActive = pathname.startsWith("/admin/dashboard/categories");
  const productsActive = pathname.startsWith("/admin/dashboard/products");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin/dashboard" />}>
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <HugeiconsIcon icon={LayoutDashboardIcon} strokeWidth={2} />
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Review desk</span>
                <span className="truncate text-xs text-muted-foreground">
                  Admin
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
                  tooltip="Overview"
                >
                  <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/admin/dashboard/supplier-verification" />}
                  isActive={queueActive}
                  tooltip="Supplier verification"
                >
                  <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />
                  <span>Supplier verification</span>
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
                  tooltip="Categories"
                >
                  <HugeiconsIcon icon={SaleTag01Icon} strokeWidth={2} />
                  <span>Categories</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/admin/dashboard/products" />}
                  isActive={productsActive}
                  tooltip="Products"
                >
                  <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />
                  <span>Products</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
