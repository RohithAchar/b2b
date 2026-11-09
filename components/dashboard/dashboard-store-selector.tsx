"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import type { ActiveStore } from "@/lib/store-context";

type DashboardStoreSelectorProps = {
  stores: ActiveStore[];
  selectedStoreId: string | null;
};

/**
 * Store switcher for the supplier dashboard.
 *
 * D2H Core keeps the user on `/supplier/dashboard` (the existing dashboard).
 * The other stores navigate to their own `/supplier/dashboard/store/[slug]`
 * route, which renders "Coming soon" until those dashboards are built.
 */
export function DashboardStoreSelector({
  stores,
  selectedStoreId,
}: DashboardStoreSelectorProps) {
  const router = useRouter();

  if (stores.length <= 1) return null;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const storeId = event.target.value;
    if (!storeId) return;
    const store = stores.find((s) => s.id === storeId);
    if (!store) return;
    if (store.slug === "d2h-core") {
      router.push("/supplier/dashboard");
    } else {
      router.push(`/supplier/dashboard/store/${store.slug}`);
    }
  };

  return (
    <form className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Store
      </span>
      <NativeSelect
        size="sm"
        defaultValue={selectedStoreId ?? ""}
        onChange={handleChange}
      >
        <option value="">Select store</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}
