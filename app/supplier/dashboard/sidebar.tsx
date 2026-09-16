"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Building02Icon,
  DashboardSquare01Icon,
  Package01Icon,
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/layout/nav-user";
import { StatusBadge } from "@/components/dashboard/status-badge";

function isEdit(productPath: string): boolean {
  return /\/products\/[\w-]+\/edit$/.test(productPath);
}

export function SupplierSidebar({
  user,
  kybStatus,
}: {
  user: { name: string; email: string };
  kybStatus: string;
}) {
  const pathname = usePathname();
  const overviewActive = pathname === "/supplier/dashboard";
  const productsActive =
    pathname === "/supplier/dashboard/products" ||
    (pathname.startsWith("/supplier/dashboard/products/") && isEdit(pathname));
  const addProductActive = pathname === "/supplier/dashboard/products/new";
  const businessActive = pathname.startsWith("/supplier/dashboard/business");
  const verificationActive = pathname.startsWith(
    "/supplier/dashboard/verification",
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/supplier/dashboard" />}
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">My business</span>
                <span className="truncate text-xs text-muted-foreground">
                  Seller workspace
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/supplier/dashboard" />}
                  isActive={overviewActive}
                  tooltip="Overview"
                >
                  <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />
                  <span>Overview</span>
                </SidebarMenuButton>
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
                  render={<Link href="/supplier/dashboard/products" />}
                  isActive={productsActive}
                  tooltip="Products"
                >
                  <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />
                  <span>Products</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/supplier/dashboard/products/new" />
                  }
                  isActive={addProductActive}
                  tooltip="Add product"
                >
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                  <span>Add product</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Business</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/supplier/dashboard/business" />}
                  isActive={businessActive}
                  tooltip="Business profile"
                >
                  <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />
                  <span>Business profile</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/supplier/dashboard/verification" />
                  }
                  isActive={verificationActive}
                  tooltip="Verification"
                >
                  <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />
                  <span>Verification</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <StatusBadge
          status="kyb"
          value={kybStatus}
          className="mx-2 justify-center"
        />
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}