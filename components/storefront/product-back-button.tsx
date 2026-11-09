"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

export function ProductBackButton() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:underline"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        Back
      </button>
    </div>
  )
}
