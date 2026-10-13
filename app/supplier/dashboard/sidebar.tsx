"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Add01Icon,
  Building02Icon,
  ChartAverageIcon,
  ChevronRightIcon,
  DashboardSquare01Icon,
  DeliveryTruck01Icon,
  DiscountTag01Icon,
  Package01Icon,
  PaintBrush01Icon,
  PercentIcon,
  PuzzleIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingCart01Icon,
  UserGroup02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { NavUser } from "@/components/layout/nav-user"
import { StatusBadge } from "@/components/dashboard/status-badge"

function isEdit(productPath: string): boolean {
  return /\/products\/[\w-]+\/edit$/.test(productPath)
}

const COMMING_SOON_TOP: [string, IconSvgElement][] = [
  ["Delivery", DeliveryTruck01Icon],
  ["Analytics", ChartAverageIcon],
  ["Payouts", Wallet01Icon],
  ["Discounts", DiscountTag01Icon],
  ["Audience", UserGroup02Icon],
  ["Appearance", PaintBrush01Icon],
  ["Plugins", PuzzleIcon],
]

export function SupplierSidebar({
  user,
  kybStatus,
}: {
  user: { name: string; email: string }
  kybStatus: string
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  // On mobile the sidebar renders as a Sheet with a hidden close button,
  // so every navigation link must close it explicitly.
  const closeMobile = () => setOpenMobile(false)
  const dashboardActive = pathname === "/supplier/dashboard"
  const ordersActive = pathname.startsWith("/supplier/dashboard/orders")
  const productsListActive = pathname === "/supplier/dashboard/products"
  const addProductActive = pathname === "/supplier/dashboard/products/new"
  const marginActive = pathname === "/supplier/dashboard/products/margin"
  const productEditActive =
    pathname.startsWith("/supplier/dashboard/products/") && isEdit(pathname)
  const productsActive =
    productsListActive || addProductActive || productEditActive || marginActive
  const businessActive = pathname.startsWith("/supplier/dashboard/business")
  const verificationActive = pathname.startsWith(
    "/supplier/dashboard/verification"
  )
  const settingsActive = businessActive || verificationActive

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={closeMobile}
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/supplier/dashboard" />}
              isActive={dashboardActive}
              onClick={closeMobile}
              tooltip="Dashboard"
            >
              <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />
              <span>Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/supplier/dashboard/orders" />}
              isActive={ordersActive}
              onClick={closeMobile}
              tooltip="Orders"
            >
              <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} />
              <span>Orders</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {COMMING_SOON_TOP.slice(0, 2).map(([label, icon]) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton
                aria-disabled="true"
                tooltip={label}
                className="cursor-default"
                title="Coming soon"
              >
                <HugeiconsIcon icon={icon} strokeWidth={2} />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          <Collapsible
            defaultOpen={productsActive}
            className="group/collapsible"
            render={<SidebarMenuItem />}
          >
            <CollapsibleTrigger
              render={
                <SidebarMenuButton isActive={productsActive} tooltip="Products">
                  <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />
                  <span>Products</span>
                  <HugeiconsIcon
                    icon={ChevronRightIcon}
                    strokeWidth={2}
                    className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
                  />
                </SidebarMenuButton>
              }
            />
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link href="/supplier/dashboard/products" />}
                    isActive={productsListActive}
                    onClick={closeMobile}
                  >
                    <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />
                    <span>All products</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link href="/supplier/dashboard/products/new" />}
                    isActive={addProductActive}
                    onClick={closeMobile}
                  >
                    <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                    <span>Add product</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={
                      <Link href="/supplier/dashboard/products/margin" />
                    }
                    isActive={marginActive}
                    onClick={closeMobile}
                  >
                    <HugeiconsIcon icon={PercentIcon} strokeWidth={2} />
                    <span>Margin</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>

          {COMMING_SOON_TOP.slice(2).map(([label, icon]) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton
                aria-disabled="true"
                tooltip={label}
                className="cursor-default"
                title="Coming soon"
              >
                <HugeiconsIcon icon={icon} strokeWidth={2} />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          <Collapsible
            defaultOpen={settingsActive}
            className="group/collapsible"
            render={<SidebarMenuItem />}
          >
            <CollapsibleTrigger
              render={
                <SidebarMenuButton isActive={settingsActive} tooltip="Settings">
                  <HugeiconsIcon icon={SettingsIcon} strokeWidth={2} />
                  <span>Settings</span>
                  <HugeiconsIcon
                    icon={ChevronRightIcon}
                    strokeWidth={2}
                    className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
                  />
                </SidebarMenuButton>
              }
            />
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link href="/supplier/dashboard/business" />}
                    isActive={businessActive}
                    onClick={closeMobile}
                  >
                    <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />
                    <span>Business profile</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link href="/supplier/dashboard/verification" />}
                    isActive={verificationActive}
                    onClick={closeMobile}
                  >
                    <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />
                    <span>Verification</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        </SidebarMenu>
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
  )
}
