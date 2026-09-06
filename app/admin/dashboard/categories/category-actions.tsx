"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteCategory,
  toggleCategory,
  type CategoryActionState,
} from "@/lib/admin/categories";

const initialState: CategoryActionState = { ok: false, message: "" };

export function ToggleVisibilityButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [, action, pending] = useActionState(toggleCategory, initialState);
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

export function DeleteCategoryButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteCategory, initialState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Delete this category? This cannot be undone.")) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {state.message ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
