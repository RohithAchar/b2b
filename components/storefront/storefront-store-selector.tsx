"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { setActiveStore } from "@/lib/store-actions";
import type { ActiveStore } from "@/lib/store-context-types";

type StorefrontStoreSelectorProps = {
  stores: ActiveStore[];
  selectedStoreId: string | null;
};

export function StorefrontStoreSelector({
  stores,
  selectedStoreId,
}: StorefrontStoreSelectorProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    setActiveStore,
    { ok: false, message: "" }
  );

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const formData = new FormData();
    formData.append("storeId", event.target.value);
    action(formData);
    router.refresh();
  };

  if (stores.length <= 1) return null;

  return (
    <form action={action} className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Store
      </span>
      <NativeSelect
        size="sm"
        defaultValue={selectedStoreId ?? ""}
        onChange={handleChange}
        disabled={pending}
      >
        <option value="">Select store</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </NativeSelect>
      {state.message && (
        <span className="text-xs text-destructive">{state.message}</span>
      )}
    </form>
  );
}
