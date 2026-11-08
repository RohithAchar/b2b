import Image from "next/image"
import Link from "next/link"
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
  active?: boolean
}

/**
 * Storefront "store type" switcher.
 *
 * Direct2Hub will eventually host several stores. Only D2H Core exists today,
 * so the other tabs are rendered as clearly disabled placeholders rather than
 * links to routes that do not exist.
 */
const STORE_TABS: StoreTab[] = [
  { id: "core", name: "D2H Core", icon: Store01Icon, mobileImage: "/stores/d2h_core_mobile.jpg", active: true },
  { id: "select", name: "D2H Select", icon: Tag01Icon, mobileImage: "/stores/d2h_select_mobile.jpg" },
  { id: "ecom-package", name: "Ecom Package", icon: Package01Icon, mobileImage: "/stores/ecom_package_mobile.jpg" },
  { id: "dropshoppicals", name: "Dropshoppicals", icon: GridViewIcon, mobileImage: "/stores/dropship_mobile.jpg" },
]

function TabBody({ tab }: { tab: StoreTab }) {
  return (
    <>
      <Image
        src={tab.mobileImage}
        alt={tab.name}
        width={89}
        height={56}
        priority={tab.active}
        className="h-10 w-auto max-w-full object-contain sm:hidden"
      />
      <div className="hidden flex-col items-center gap-1 sm:flex">
        <HugeiconsIcon
          icon={tab.icon}
          strokeWidth={tab.active ? 2.2 : 1.8}
          aria-hidden="true"
          className="size-[18px] shrink-0 sm:size-5"
        />
        <span className="w-full truncate text-center text-[10px] leading-tight font-semibold tracking-tight sm:text-xs">
          {tab.name}
        </span>
      </div>
      {!tab.active ? (
        <span className="absolute top-1 right-1 rounded-sm bg-muted px-1 text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
          Soon
        </span>
      ) : null}
    </>
  )
}

export function StoreTabs() {
  return (
    <nav aria-label="Store types" className="border-b border-border bg-card">
      <ul className="mx-auto grid w-full max-w-7xl grid-cols-4 gap-2 px-4 py-2.5 sm:gap-3 sm:py-3">
        {STORE_TABS.map((tab) => (
          <li key={tab.id} className="min-w-0">
            {tab.active ? (
              <Link
                href="/"
                aria-current="page"
                className={cn(
                  "press relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-primary bg-primary/5 px-1 py-2.5 text-brand-700 sm:px-2",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                )}
              >
                <TabBody tab={tab} />
              </Link>
            ) : (
              <div
                aria-disabled="true"
                title="Coming soon"
                className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 py-2.5 text-muted-foreground sm:px-2"
              >
                <TabBody tab={tab} />
                <span className="sr-only">Coming soon</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
