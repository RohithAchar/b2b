"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  deleteBanner,
  toggleBanner,
  type BannerActionState,
} from "@/lib/admin/banners";

const initialState: BannerActionState = { ok: false, message: "" };

export function ToggleVisibilityButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [, action, pending] = useActionState(toggleBanner, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        aria-pressed={isActive}
      >
        {isActive ? "Visible" : "Hidden"}
      </Button>
    </form>
  );
}

export function DeleteBannerButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteBanner, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmDialog
        trigger={
          <Button type="button" variant="destructive" disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        }
        title="Delete banner?"
        description="This cannot be undone. The banner will disappear from the home page."
        confirmLabel={pending ? "Deleting…" : "Delete"}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
      <form ref={formRef} action={action}>
        <input type="hidden" name="id" value={id} />
      </form>
      {state.message ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}