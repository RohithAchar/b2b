export const NAV_LINKS = [
  { label: "Categories", href: "/products" },
  { label: "Suppliers", href: "/products" },
  { label: "Wholesale Deals", href: "/products" },
  { label: "New Arrivals", href: "/products" },
];

export function dashboardHref(userType: string, isStaff = false): string {
  if (userType === "admin" && !isStaff) return "/admin/dashboard";
  if (userType === "supplier" || isStaff) return "/supplier/dashboard";
  return "/";
}