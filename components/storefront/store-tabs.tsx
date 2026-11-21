"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type StoreTab = {
  id: string
  /** Short brand name on the card ("Core"); `fullName` is for screen readers. */
  name: string
  fullName: string
  /** Brand icon in public/stores (transparent WebP, 128px tall). */
  icon: { src: string; width: number }
  /** null = not open yet ("Soon"). */
  href: string | null
}

/** The store brands inside Direct2Hub. Only Core is live; the rest are "Soon". */
const STORE_TABS: StoreTab[] = [
  { id: "core", name: "Core", fullName: "D2H Core", icon: { src: "/stores/store-core.webp", width: 118 }, href: "/" },
  { id: "select", name: "Select", fullName: "D2H Select", icon: { src: "/stores/store-select.webp", width: 179 }, href: null },
  { id: "package", name: "Package", fullName: "Ecom Package", icon: { src: "/stores/store-package.webp", width: 122 }, href: null },
  { id: "dropship", name: "Dropship", fullName: "Dropship", icon: { src: "/stores/store-dropship.webp", width: 190 }, href: null },
]

function isActiveTab(tab: StoreTab, pathname: string): boolean {
  return tab.id === "core" && pathname === "/"
}

// Frosted card, brand icon over the name. Motion and the active gradient border
// live in globals.css (.store-tab*). Staggered rise-in by position.
const CARD =
  "store-tab flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 sm:gap-1.5 sm:py-3 lg:gap-1 lg:py-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
const RISE_DELAY = ["0.05s", "0.15s", "0.25s", "0.35s"]

function CardBody({ tab, soon }: { tab: StoreTab; soon: boolean }) {
  return (
    <>
      <Image
        src={tab.icon.src}
        alt=""
        aria-hidden
        width={tab.icon.width}
        height={128}
        priority
        unoptimized
        className="store-tab-icon h-7 w-auto shrink-0 sm:h-8 lg:h-7"
      />
      <span
        className={cn(
          "w-full truncate text-center text-sm leading-tight font-extrabold tracking-tight sm:text-base",
          soon ? "text-foreground/70" : "text-foreground",
        )}
      >
        {tab.name}
      </span>
      {soon ? (
        <span className="store-tab-badge top-1.5 right-1.5 rounded-md border border-border bg-card px-1 text-[10px] font-bold tracking-wide text-foreground/70 uppercase shadow-xs">
          Soon
        </span>
      ) : null}
    </>
  )
}

/** Store brand switcher shown above every storefront page. */
export function StoreTabs() {
  const pathname = usePathname() ?? "/"
  return (
    <nav aria-label="Stores inside Direct2Hub" className="store-tabs border-b border-border">
      <span aria-hidden className="store-tabs-blob -top-40 left-[5%] size-80 bg-brand-200" />
      <span aria-hidden className="store-tabs-blob -bottom-36 left-[45%] size-64 bg-brand-100 [animation-delay:-5s]" />
      <span aria-hidden className="store-tabs-blob -top-32 right-[4%] size-56 bg-brand-300 [animation-delay:-9s]" />
      <ul className="mx-auto grid w-full max-w-7xl grid-cols-4 gap-2 px-4 py-2.5 sm:gap-3 sm:py-3">
        {STORE_TABS.map((tab, i) => {
          const active = isActiveTab(tab, pathname)
          // Rise-in stagger, and the idle light sweep crossing cards in turn (all screens).
          const style = {
            animationDelay: RISE_DELAY[i],
            "--store-tab-sweep-delay": `${1.2 + i * 0.35}s`,
          } as React.CSSProperties
          return (
            <li key={tab.id} className="min-w-0">
              {tab.href ? (
                <Link
                  href={tab.href}
                  aria-label={tab.fullName}
                  aria-current={active ? "page" : undefined}
                  data-active={active}
                  style={style}
                  className={cn(CARD, "press")}
                >
                  <CardBody tab={tab} soon={false} />
                </Link>
              ) : (
                <button
                  type="button"
                  aria-label={`${tab.fullName}, coming soon`}
                  style={style}
                  className={cn(CARD, "press")}
                  onClick={() => toast.add({ title: `${tab.fullName} is coming soon` })}
                >
                  <CardBody tab={tab} soon />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
