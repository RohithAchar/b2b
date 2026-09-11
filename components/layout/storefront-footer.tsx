import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const trustBadges = [
  "Verified Suppliers",
  "Quality Assured",
  "Secure Trading",
  "Buyer Protection",
];

const buyerLinks = [
  { label: "Browse Products", href: "/products" },
  { label: "How to Buy", href: "#" },
  { label: "Buyer Protection", href: "#" },
];

const supplierLinks = [
  { label: "Become a Supplier", href: "/supplier/onboarding" },
  { label: "Supplier Dashboard", href: "/supplier/dashboard" },
];

const aboutLinks = [
  { label: "About Us", href: "#" },
  { label: "Contact", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Privacy Policy", href: "#" },
];

export function StorefrontFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      {/* Trust badges */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-4 py-5">
          {trustBadges.map((badge) => (
            <Badge key={badge} variant="secondary" className="px-3 py-1 text-sm">
              {badge}
            </Badge>
          ))}
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4">
        <div>
          <h3 className="mb-3 text-sm font-medium">For Buyers</h3>
          <ul className="space-y-2">
            {buyerLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium">For Suppliers</h3>
          <ul className="space-y-2">
            {supplierLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium">About</h3>
          <ul className="space-y-2">
            {aboutLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium">Contact</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Email: support@marketplace.com</li>
            <li>Phone: +91 123 456 7890</li>
            <li>Mon-Sat: 9:00 AM - 6:00 PM</li>
          </ul>
        </div>
      </div>

      <Separator />

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} B2B Marketplace. All rights reserved.</span>
        <span>Made in India</span>
      </div>
    </footer>
  );
}
