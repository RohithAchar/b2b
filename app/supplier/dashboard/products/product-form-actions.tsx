"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { SendIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function ProductFormActions({
  pending,
  pendingAction,
  onSaveDraft,
  onSaveSubmit,
  showSubmit = true,
  saveLabel = "Save draft",
}: {
  pending: boolean
  pendingAction: "draft" | "submit" | null
  onSaveDraft: () => void
  onSaveSubmit: () => void
  showSubmit?: boolean
  saveLabel?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {showSubmit ? (
        <Button type="button" disabled={pending} onClick={onSaveSubmit}>
          {pending && pendingAction === "submit" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <HugeiconsIcon
              icon={SendIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
          )}
          {pending && pendingAction === "submit"
            ? "Submitting…"
            : "Save & submit for approval"}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onSaveDraft}
      >
        {pending && pendingAction === "draft" ? (
          <Spinner data-icon="inline-start" />
        ) : null}
        {pending && pendingAction === "draft" ? "Saving…" : saveLabel}
      </Button>
    </div>
  )
}

export function ProductFormStickyActions({
  pending,
  pendingAction,
  onSaveDraft,
  onSaveSubmit,
  showSubmit = true,
  saveLabel = "Save draft",
}: {
  pending: boolean
  pendingAction: "draft" | "submit" | null
  onSaveDraft: () => void
  onSaveSubmit: () => void
  showSubmit?: boolean
  saveLabel?: string
}) {
  return (
    <div className="@3xl/content:hidden">
      <div
        data-scrolled="true"
        data-edge="above"
        className="scroll-edge sticky bottom-0 z-10 -mx-4 mt-4 material px-4 py-3"
      >
        <div className="flex flex-col gap-2">
          {showSubmit ? (
            <Button type="button" disabled={pending} onClick={onSaveSubmit}>
              {pending && pendingAction === "submit" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HugeiconsIcon
                  icon={SendIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
              )}
              {pending && pendingAction === "submit"
                ? "Submitting…"
                : "Save & submit for approval"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onSaveDraft}
          >
            {pending && pendingAction === "draft" ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            {pending && pendingAction === "draft" ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
