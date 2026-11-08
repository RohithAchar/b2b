import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { StoreSelector } from "@/components/dashboard/store-selector";
import { getStoreSelectorItems } from "@/lib/admin/stores";
import { ToggleStoreButton } from "./store-actions";

export default async function StoresPage() {
  const supabase = await createClient();
  const [storesResult, selectorItems] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name, slug, status, description, created_at")
      .order("name"),
    getStoreSelectorItems(),
  ]);

  const stores = storesResult.data ?? [];

  return (
    <div className="mx-auto flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Stores</h1>
          <p className="text-sm text-muted-foreground">
            Manage storefronts. Admins can create, edit, activate, and
            deactivate stores.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StoreSelector
            stores={selectorItems}
            selectedStoreId={null}
            label="View store"
          />
          <Button
            render={<Link href="/admin/dashboard/stores/new" />}
            nativeButton={false}
          >
            Add store
          </Button>
        </div>
      </div>

      {stores.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyTitle>No stores yet</EmptyTitle>
              <EmptyDescription>
                Add the first store to get started.
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <ItemGroup>
              {stores.map((store) => (
                <Item key={store.id} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{store.name}</ItemTitle>
                    <div className="text-xs text-muted-foreground">
                      {store.slug}
                    </div>
                    {store.description ? (
                      <p className="text-xs text-muted-foreground truncate max-w-md">
                        {store.description}
                      </p>
                    ) : null}
                  </ItemContent>
                  <ItemActions>
                    <StatusBadge
                      status="visibility"
                      value={store.status}
                      className="w-fit"
                    />
                    <ToggleStoreButton id={store.id} isActive={store.status === "active"} />
                    <Button
                      render={
                        <Link
                          href={`/admin/dashboard/stores/${store.id}/edit`}
                        />
                      }
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                    >
                      Edit
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
