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
  ["Payouts", Wallet01Icon],
  ["Appearance", PaintBrush01Icon],
  ["Plugins", PuzzleIcon],
]

export function SupplierSidebar({
  user,
  kybStatus,
  isStaff = false,
}: {
  user: { name: string; email: string }
  kybStatus: string
  isStaff?: boolean
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  // On mobile the sidebar renders as a Sheet with a hidden close button,
  // so every navigation link must close it explicitly.
  const closeMobile = () => setOpenMobile(false)
  const dashboardActive = pathname === "/supplier/dashboard"
  const ordersActive = pathname.startsWith("/supplier/dashboard/orders")
  const salesActive = pathname.startsWith("/supplier/dashboard/analytics/sales")
  const trafficActive = pathname.startsWith("/supplier/dashboard/analytics/traffic")
  const productsAnalyticsActive = pathname.startsWith("/supplier/dashboard/analytics/products")
  const analyticsActive = pathname.startsWith("/supplier/dashboard/analytics")
  const discountsActive = pathname.startsWith("/supplier/dashboard/discounts")
  const audienceActive = pathname.startsWith("/supplier/dashboard/audience")
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
  const teamActive = pathname.startsWith("/supplier/dashboard/team")
  const settingsActive = businessActive || verificationActive || teamActive

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

          {COMMING_SOON_TOP.slice(0, 1).map(([label, icon]) => (
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
            defaultOpen={analyticsActive}
            className="group/collapsible"
            render={<SidebarMenuItem />}
          >
            <CollapsibleTrigger
              render={
                <SidebarMenuButton isActive={analyticsActive} tooltip="Analytics">
                  <HugeiconsIcon icon={ChartAverageIcon} strokeWidth={2} />
                  <span>Analytics</span>
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
                    render={<Link href="/supplier/dashboard/analytics/sales" />}
                    isActive={salesActive}
                    onClick={closeMobile}
                  >
                    <HugeiconsIcon icon={ChartAverageIcon} strokeWidth={2} />
                    <span>Sales</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link href="/supplier/dashboard/analytics/traffic" />}
                    isActive={trafficActive}
                    onClick={closeMobile}
                  >
                    <HugeiconsIcon icon={UserGroup02Icon} strokeWidth={2} />
                    <span>Traffic</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link href="/supplier/dashboard/analytics/products" />}
                    isActive={productsAnalyticsActive}
                    onClick={closeMobile}
                  >
                    <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />
                    <span>Products</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>

          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/supplier/dashboard/discounts" />}
              isActive={discountsActive}
              onClick={closeMobile}
              tooltip="Discounts"
            >
              <HugeiconsIcon icon={DiscountTag01Icon} strokeWidth={2} />
              <span>Discounts</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/supplier/dashboard/audience" />}
              isActive={audienceActive}
              onClick={closeMobile}
              tooltip="Audience"
            >
              <HugeiconsIcon icon={UserGroup02Icon} strokeWidth={2} />
              <span>Audience</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

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
                {isStaff ? null : (
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
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>

          {COMMING_SOON_TOP.slice(1).map(([label, icon]) => (
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

          {isStaff ? null : (
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
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link href="/supplier/dashboard/team" />}
                      isActive={teamActive}
                      onClick={closeMobile}
                    >
                      <HugeiconsIcon icon={UserGroup02Icon} strokeWidth={2} />
                      <span>Team</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )}
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
