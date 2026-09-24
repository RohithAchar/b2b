"use client";

import { Button } from "@/components/ui/button";

export function ProductFormActions({
  pending,
  pendingAction,
  onSaveDraft,
  onSaveSubmit,
  showSubmit = true,
}: {
  pending: boolean;
  pendingAction: "draft" | "submit" | null;
  onSaveDraft: () => void;
  onSaveSubmit: () => void;
  showSubmit?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {showSubmit ? (
        <Button type="button" disabled={pending} onClick={onSaveSubmit}>
          {pending && pendingAction === "submit" ? "Submitting…" : "Save & submit for approval"}
        </Button>
      ) : null}
      <Button type="button" variant="outline" disabled={pending} onClick={onSaveDraft}>
        {pending && pendingAction === "draft" ? "Saving…" : "Save draft"}
      </Button>
    </div>
  );
}

export function ProductFormStickyActions({
  pending,
  pendingAction,
  onSaveDraft,
  onSaveSubmit,
  showSubmit = true,
}: {
  pending: boolean;
  pendingAction: "draft" | "submit" | null;
  onSaveDraft: () => void;
  onSaveSubmit: () => void;
  showSubmit?: boolean;
}) {
  return (
    <div className="@3xl/content:hidden">
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-2">
          {showSubmit ? (
            <Button type="button" disabled={pending} onClick={onSaveSubmit}>
              {pending && pendingAction === "submit" ? "Submitting…" : "Save & submit for approval"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={pending} onClick={onSaveDraft}>
            {pending && pendingAction === "draft" ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </div>
    </div>
  );
}