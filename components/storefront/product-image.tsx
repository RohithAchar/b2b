"use client"

import { useState } from "react"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageNotFound01Icon } from "@hugeicons/core-free-icons"

/**
 * Product cover with a deliberate fallback for both missing paths and URLs
 * that fail to load, so a broken record never renders as blank space.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string | null
  alt: string
  sizes?: string
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
        <HugeiconsIcon
          icon={ImageNotFound01Icon}
          strokeWidth={1.5}
          className="size-6"
        />
        <span className="text-[11px] font-medium">No image</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      loading={priority ? "eager" : undefined}
      sizes={sizes}
      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      onError={() => setFailed(true)}
    />
  )
}
