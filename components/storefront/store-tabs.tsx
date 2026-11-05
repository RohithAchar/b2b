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
  { id: "core", name: "D2H Core", icon: Store01Icon, active: true },
  { id: "select", name: "D2H Select", icon: Tag01Icon },
  { id: "ecom-package", name: "Ecom Package", icon: Package01Icon },
  { id: "dropshoppicals", name: "Dropshoppicals", icon: GridViewIcon },
]

function TabBody({ tab }: { tab: StoreTab }) {
  return (
    <>
      <HugeiconsIcon
        icon={tab.icon}
        strokeWidth={tab.active ? 2.2 : 1.8}
        aria-hidden="true"
        className="size-[18px] shrink-0 sm:size-5"
      />
      <span className="w-full truncate text-center text-[10px] leading-tight font-semibold tracking-tight sm:text-xs">
        {tab.name}
      </span>
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
    <nav aria-label="Store types" className="border-b border-border bg-card lg:hidden">
      <ul className="mx-auto grid w-full max-w-7xl grid-cols-4 gap-2 px-4 py-2.5 sm:gap-3 sm:py-3">
        {STORE_TABS.map((tab) => (
          <li key={tab.id} className="min-w-0">
            {tab.active ? (
              <Link
                href="/"
                aria-current="page"
                className={cn(
                  "press relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-primary bg-primary/5 px-0.5 py-2 text-brand-700 sm:px-1.5",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                )}
              >
                <TabBody tab={tab} />
              </Link>
            ) : (
              <div
                aria-disabled="true"
                title="Coming soon"
                className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-0.5 py-2 text-muted-foreground sm:px-1.5"
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
