"use client"

import * as React from "react"
import { Fragment, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUpRight01Icon,
  BoxIcon,
  Cancel01Icon,
  ChevronRightIcon,
  ContainerTruckIcon,
  FlashIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

const specCells = [
  {
    icon: BoxIcon,
    label: "FBD",
    description: "Placeholder details for FBD. Replace with real content.",
  },
  {
    icon: ContainerTruckIcon,
    label: "DDP",
    description: "Placeholder details for DDP. Replace with real content.",
  },
  {
    icon: FlashIcon,
    label: "Fast Delivery",
    description: "Placeholder details for Fast Delivery. Replace with real content.",
  },
]

const placeholderRows = [
  { label: "Status", value: "Placeholder" },
  { label: "Coverage", value: "Placeholder" },
  { label: "Estimated time", value: "Placeholder" },
  { label: "Tracking", value: "Placeholder" },
]

/**
 * Service strip. FBD and DDP are display-only labels (the marketplace has no
 * per-option configuration yet); WhatsApp is a real share/contact deep link.
 * Tapping a spec cell opens a bottom drawer with placeholder details.
 */
export function ProductServiceOptions({ whatsappHref }: { whatsappHref: string }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<(typeof specCells)[number] | null>(null)

  function openDrawer(cell: (typeof specCells)[number]) {
    setSelected(cell)
    setOpen(true)
  }

  return (
    <section aria-labelledby="service-options-heading">
      <h2
        id="service-options-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Service &amp; Delivery
      </h2>
      <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-stretch">
          {specCells.map((cell, index) => (
            <Fragment key={cell.label}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center px-0.5 text-brand-amber/70"
                >
                  <HugeiconsIcon icon={ChevronRightIcon} strokeWidth={1.5} className="size-3.5 -translate-x-px" />
                </span>
              )}
              <button
                type="button"
                onClick={() => openDrawer(cell)}
                className={cn(
                  "press group flex min-w-0 flex-1 flex-col gap-2 px-3 py-3 text-left outline-none transition-colors",
                  "hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-brand-700 [&_svg]:size-4">
                  <HugeiconsIcon icon={cell.icon} strokeWidth={2} />
                </span>
                <span className="min-w-0 text-sm font-semibold leading-tight text-foreground">
                  {cell.label}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "press group flex items-center gap-2 border-t border-border bg-primary/10 px-3 py-2.5 text-sm font-semibold text-brand-700 outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-brand-700 focus-visible:ring-inset",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary/15 text-brand-700 [&_svg]:size-4">
            <HugeiconsIcon icon={WhatsappIcon} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1 group-hover:underline group-hover:underline-offset-2">
            WhatsApp Now
          </span>
          <HugeiconsIcon
            icon={ArrowUpRight01Icon}
            strokeWidth={2}
            className="size-3.5 shrink-0"
          />
        </a>
      </div>

      <Drawer open={open} onOpenChange={setOpen} swipeDirection="down" showSwipeHandle>
        <DrawerContent
          className="inset-x-0 bottom-0 min-h-[80vh] max-h-[88vh] rounded-t-lg rounded-b-none border-x-0 border-b-0"
          style={{ "--drawer-inset": "0px" } as React.CSSProperties}
        >
          <DrawerHeader className="relative">
            <DrawerTitle>{selected?.label ?? "Service & Delivery"}</DrawerTitle>
            <DrawerDescription>
              Placeholder details — replace with real content.
            </DrawerDescription>
            <DrawerClose
              render={
                <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" />
              }
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto space-y-4 px-4 pb-6">
            <p className="text-sm text-muted-foreground">
              {selected?.description}
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="divide-y divide-border">
                {placeholderRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  )
}
