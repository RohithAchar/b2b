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
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
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
  );
}

export function StorefrontFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4">
        <LinkColumn
          title="For Buyers"
          links={[{ label: "Browse Products", href: "/products" }]}
        />
        <LinkColumn
          title="For Suppliers"
          links={[
            { label: "Become a Supplier", href: "/supplier/onboarding" },
            { label: "Supplier Dashboard", href: "/supplier/dashboard" },
          ]}
        />
        <LinkColumn
          title="Account"
          links={[
            { label: "Sign in", href: "/auth/login" },
            { label: "Register", href: "/auth/login" },
          ]}
        />
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