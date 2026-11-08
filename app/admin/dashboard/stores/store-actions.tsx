"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { toggleStore, type StoreActionState } from "@/lib/admin/stores";

const initialState: StoreActionState = { ok: false, message: "" };

export function ToggleStoreButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [, action, pending] = useActionState(toggleStore, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        aria-pressed={isActive}
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}
