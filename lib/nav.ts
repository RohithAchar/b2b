export const NAV_LINKS = [
  { label: "Categories", href: "/products" },
  { label: "Suppliers", href: "/products" },
  { label: "Wholesale Deals", href: "/products" },
  { label: "New Arrivals", href: "/products" },
];

export function dashboardHref(userType: string): string {
  if (userType === "admin") return "/admin/dashboard";
  if (userType === "supplier") return "/supplier/dashboard";
  return "/";
}