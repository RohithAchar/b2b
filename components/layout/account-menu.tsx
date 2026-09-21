"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building02Icon,
  DashboardSquare01Icon,
  Logout01Icon,
  Package01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

type AccountUser = { email: string; user_type: string };

function initials(value: string): string {
  const name = value.includes("@") ? value.split("@")[0] : value;
  const parts = name.replace(/[._-]+/g, " ").trim().split(/\s+/);
  if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function roleLabel(userType: string): string {
  const label =
    userType === "admin"
      ? "Admin"
      : userType === "supplier"
        ? "Supplier"
        : "Buyer";
  return `${label} account`;
}

const ROLE_LINKS: Record<string, { label: string; href: string; icon: ReactNode }[]> = {
  supplier: [
    {
      label: "Dashboard",
      href: "/supplier/dashboard",
      icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
    },
    {
      label: "Business profile",
      href: "/supplier/dashboard/business",
      icon: <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />,
    },
    {
      label: "Products",
      href: "/supplier/dashboard/products",
      icon: <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />,
    },
    {
      label: "Verification",
      href: "/supplier/dashboard/verification",
      icon: <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />,
    },
  ],
  admin: [
    {
      label: "Admin dashboard",
      href: "/admin/dashboard",
      icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
    },
  ],
};

export function AccountMenu({ user }: { user: AccountUser }) {
  const fallback = user?.email ? initials(user.email) : "U";
  const links = ROLE_LINKS[user?.user_type || ""] ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Account" className="cursor-pointer" />}
      >
        <Avatar>
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="min-w-56 rounded-lg"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="size-8">
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user?.email}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleLabel(user?.user_type || "buyer")}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {links.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {links.map((link) => (
                <DropdownMenuItem
                  key={link.href}
                  render={<Link href={link.href} />}
                >
                  {link.icon}
                  {link.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem
            variant="destructive"
            nativeButton
            render={<button type="submit" className="w-full" />}
          >
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}