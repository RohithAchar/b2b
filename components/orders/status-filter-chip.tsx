"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { cn } from "cn"
import { springSnappy } from "@/lib/motion"

/**
 * One pill in a status filter chip row (the rounded filter rows DESIGN.md
 * allows as the single pill exception). The active pill's fill is one shared
 * `layoutId` layer, so switching filters springs the fill across the row
 * instead of blinking it in place — each row passes its own `layoutId` so
 * separate rows never animate into each other.
 */
export function StatusFilterChip({
  href,
  label,
  count,
  active,
  layoutId,
}: {
  href: string
  label: string
  count: number
  active: boolean
  /** Unique per filter row so rows never hand off to each other. */
  layoutId: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex press items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        active
          ? "border-primary"
          : "border-border bg-card text-foreground hover:bg-muted"
      )}
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          transition={springSnappy}
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary"
        />
      ) : null}
      <span className={cn("relative", active && "text-primary-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "relative rounded-full px-1.5 text-[11px] tabular-nums",
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </Link>
  )
}
