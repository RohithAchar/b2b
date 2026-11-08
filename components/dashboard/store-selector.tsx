"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

export type StoreSelectorItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type StoreSelectorProps = {
  stores: StoreSelectorItem[];
  selectedStoreId: string | null;
  label?: string;
};

export function StoreSelector({
  stores,
  selectedStoreId,
  label = "Select store",
}: StoreSelectorProps) {
  const router = useRouter();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const storeId = event.target.value;
    if (!storeId) return;
    router.push(`/admin/dashboard?storeId=${storeId}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <NativeSelect
        size="sm"
        defaultValue={selectedStoreId ?? ""}
        onChange={handleChange}
      >
        <option value="">All stores</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
            {store.status !== "active" ? ` (${store.status})` : null}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
