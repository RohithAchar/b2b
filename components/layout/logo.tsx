"use client"

import Link from "next/link"
import Image from "next/image"

/**
 * Brand logo mark (replaces the former text "D2B" / "D" badge logo).
 * Renders the public/logo.jpg mark wrapped in a home link.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className="flex shrink-0 items-center">
      <Image
        src="/logo.jpg"
        alt="D2B logo"
        width={40}
        height={40}
        className={className ?? "size-8"}
      />
    </Link>
  )
}
