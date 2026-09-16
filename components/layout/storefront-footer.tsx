import Link from "next/link";
import { Separator } from "@/components/ui/separator";

function LinkColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
        {title}
      </h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-white/60 hover:text-primary hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StorefrontFooter() {
  return (
    <footer className="border-t border-border/60 bg-brand-navy text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4">
        <div className="col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              B
            </span>
            <span className="text-base font-bold tracking-tight">
              B2B Marketplace
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-white/60">
            India&apos;s wholesale marketplace. Buy and sell bulk products
            directly from verified manufacturers, wholesalers and suppliers
            across the country.
          </p>
        </div>
        <LinkColumn
          title="For Buyers"
          links={[
            { label: "Browse Products", href: "/products" },
            { label: "Browse Categories", href: "/products" },
            { label: "Wholesale Deals", href: "/products" },
          ]}
        />
        <LinkColumn
          title="For Suppliers"
          links={[
            { label: "Become a Supplier", href: "/supplier/onboarding" },
            { label: "Supplier Dashboard", href: "/supplier/dashboard" },
            { label: "Post Requirements", href: "/products" },
          ]}
        />
        <LinkColumn
          title="Account"
          links={[
            { label: "Sign in", href: "/auth/login" },
            { label: "Register", href: "/auth/login" },
            { label: "Your Dashboard", href: "/products" },
          ]}
        />
      </div>

      <Separator className="bg-white/10" />

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/50">
        <span>
          &copy; {new Date().getFullYear()} B2B Marketplace. All rights
          reserved.
        </span>
        <span className="font-medium text-white/70">
          Made in India for India&apos;s wholesale trade
        </span>
      </div>
    </footer>
  );
}