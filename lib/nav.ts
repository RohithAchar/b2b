export const NAV_LINKS = [
  { label: "Categories", href: "/products" },
  { label: "Suppliers", href: "/products" },
  { label: "Wholesale Deals", href: "/products" },
  { label: "New Arrivals", href: "/products" },
]

type NavUser = { user_type: string; isStaff?: boolean } | null

/**
 * Storefront nav links: the discovery links always, plus **Orders** for every
 * signed-in user. `/orders` is the buyer's order history; suppliers and admins
 * also shop, and their own order queues stay reachable from the account menu.
 * Signed-out visitors keep the discovery-only list — `/orders` redirects to
 * login.
 */
export function navLinksFor(user: NavUser) {
  if (!user) return NAV_LINKS
  return [...NAV_LINKS, { label: "Orders", href: "/orders" }]
}

export function dashboardHref(userType: string, isStaff = false): string {
  if (userType === "admin" && !isStaff) return "/admin/dashboard"
  if (userType === "supplier" || isStaff) return "/supplier/dashboard"
  return "/"
}
