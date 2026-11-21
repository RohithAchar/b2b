"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { selectDashboardStore } from "@/lib/supplier/dashboard-store-actions";
import { isDashboardReady } from "@/lib/store-context-types";

type StoreOption = { id: string; name: string; slug: string };

/**
 * Store switcher for the supplier dashboard. Open stores (DASHBOARD_READY_STORES,
 * currently D2H Core) switch in place; the others are labelled "(soon)" and
 * open the coming-soon page.
 */
export function DashboardStoreSelector({
  stores,
  selectedStoreId,
}: {
  stores: StoreOption[];
  selectedStoreId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (stores.length <= 1) return null;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const store = stores.find((s) => s.id === event.target.value);
    if (!store) return;
    if (!isDashboardReady(store.slug)) {
      router.push(`/supplier/dashboard/store/${store.slug}`);
      return;
    }
    startTransition(async () => {
      const result = await selectDashboardStore(store.id);
      if (!result.ok) {
        toast.add({ type: "error", title: "Could not switch store", description: result.message });
        return;
      }
      router.refresh();
    });
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Store</span>
      <NativeSelect
        size="sm"
        value={selectedStoreId ?? ""}
        onChange={handleChange}
        disabled={pending}
        aria-busy={pending}
      >
        {stores.map((store) => (
          <NativeSelectOption key={store.id} value={store.id}>
            {store.name}
            {isDashboardReady(store.slug) ? "" : " (soon)"}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}
