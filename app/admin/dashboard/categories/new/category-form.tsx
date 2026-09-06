"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCategory,
  type CategoryActionState,
} from "@/lib/admin/categories";

const initialState: CategoryActionState = { ok: false, message: "" };

export function NewCategoryForm({
  parents,
  preselectedParent,
}: {
  parents: { id: string; name: string }[];
  preselectedParent: string;
}) {
  const [state, action, pending] = useActionState(createCategory, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="parent_id">Parent (leave empty for a top-level category)</Label>
        <select
          id="parent_id"
          name="parent_id"
          defaultValue={preselectedParent}
          className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none"
        >
          <option value="">No parent — top-level category</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          placeholder="e.g. Footwear"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="image">Image (JPG, PNG or WEBP, max 5 MB)</Label>
        <Input
          id="image"
          name="image"
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          required
        />
      </div>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save category"}
      </Button>
    </form>
  );
}
