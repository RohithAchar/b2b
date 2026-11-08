"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  GridViewIcon,
  Package01Icon,
  Store01Icon,
  Tag01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type StoreTab = {
  id: string
  name: string
  icon: IconSvgElement
  mobileImage: string
  href: string
}

/**
 * Storefront "store type" switcher.
 *
 * D2H Core and D2H Select are real destinations; the remaining stores are
 * still disabled placeholders.
 */
const STORE_TABS: StoreTab[] = [
  { id: "core", name: "D2H Core", icon: Store01Icon, mobileImage: "/stores/d2h_core_mobile.jpg", href: "/" },
  { id: "select", name: "D2H Select", icon: Tag01Icon, mobileImage: "/stores/d2h_select_mobile.jpg", href: "/select" },
  { id: "ecom-package", name: "Ecom Package", icon: Package01Icon, mobileImage: "/stores/ecom_package_mobile.jpg", href: "#" },
  { id: "dropshoppicals", name: "Dropshoppicals", icon: GridViewIcon, mobileImage: "/stores/dropship_mobile.jpg", href: "#" },
]

function isActiveTab(tab: StoreTab, pathname: string): boolean {
  if (tab.id === "core") return pathname === "/"
  if (tab.id === "select") return pathname === "/select" || pathname.startsWith("/select/")
  return false
}

function TabBody({ tab, active }: { tab: StoreTab; active: boolean }) {
  return (
    <>
      <Image
        src={tab.mobileImage}
        alt={tab.name}
        width={89}
        height={56}
        priority={active}
        className="h-10 w-auto max-w-full object-contain sm:hidden"
      />
      <div className="hidden flex-col items-center gap-1 sm:flex">
        <HugeiconsIcon
          icon={tab.icon}
          strokeWidth={active ? 2.2 : 1.8}
          aria-hidden="true"
          className="size-[18px] shrink-0 sm:size-5"
        />
        <span className="w-full truncate text-center text-[10px] leading-tight font-semibold tracking-tight sm:text-xs">
          {tab.name}
        </span>
      </div>
      {!active && tab.href === "#" ? (
        <span className="absolute top-1 right-1 rounded-sm bg-muted px-1 text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
          Soon
        </span>
      ) : null}
    </>
  )
}

export function StoreTabs() {
  const pathname = usePathname() ?? "/"
  return (
    <nav aria-label="Store types" className="border-b border-border bg-card">
      <ul className="mx-auto grid w-full max-w-7xl grid-cols-4 gap-2 px-4 py-2.5 sm:gap-3 sm:py-3">
        {STORE_TABS.map((tab) => {
          const active = isActiveTab(tab, pathname)
          return (
            <li key={tab.id} className="min-w-0">
              {tab.href !== "#" ? (
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 sm:px-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                    active
                      ? "border border-primary bg-primary/5 text-brand-700"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TabBody tab={tab} active={active} />
                </Link>
              ) : (
                <div
                  aria-disabled="true"
                  title="Coming soon"
                  className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 py-2.5 text-muted-foreground sm:px-2"
                >
                  <TabBody tab={tab} active={false} />
                  <span className="sr-only">Coming soon</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}