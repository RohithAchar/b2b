import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/storage";
import {
  DeleteBannerButton,
  ToggleVisibilityButton,
} from "./banner-actions";

const SLOT_LABELS: Record<string, string> = {
  hero: "Hero carousel",
  promo: "Promotional strip",
};

const SLOT_HINTS: Record<string, string> = {
  hero: "Rotates at the top of the home page (aim for a wide 1200 x 256 image).",
  promo: "Single strip under the category grid (aim for a wide, short image).",
};

export default async function BannersPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("home_banners")
    .select("id, slot, title, subtitle, link_url, image_path, is_active, sort_order")
    .order("sort_order")
    .order("created_at");

  const grouped = new Map<string, typeof rows>();
  for (const row of rows ?? []) {
    const group = grouped.get(row.slot) ?? [];
    group.push(row);
    grouped.set(row.slot, group);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Home banners</h1>
          <p className="text-sm text-muted-foreground">
            The images buyers see at the top of the storefront. Hidden
            banners stay invisible until you turn them on.
          </p>
        </div>
      </div>

      {["hero", "promo"].map((slot) => {
        const banners = grouped.get(slot) ?? [];
        return (
          <Card key={slot}>
            <CardHeader>
              <CardTitle>{SLOT_LABELS[slot]}</CardTitle>
              <CardDescription>{SLOT_HINTS[slot]}</CardDescription>
              <CardAction>
                <Badge variant="secondary">{banners.length} live</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {banners.length === 0 ? (
                <Card>
                  <CardContent>
                    <Empty>
                      <EmptyTitle>No {SLOT_LABELS[slot].toLowerCase()} yet</EmptyTitle>
                      <EmptyDescription>
                        Add one to replace the placeholder on the home page.
                      </EmptyDescription>
                    </Empty>
                  </CardContent>
                </Card>
              ) : (
                <ItemGroup>
                  {banners.map((banner) => (
                    <Item key={banner.id} variant="outline" size="sm">
                      {banner.image_path && banner.image_path !== "pending" ? (
                        <ItemMedia variant="image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={publicImageUrl("banners", banner.image_path)} alt="" />
                        </ItemMedia>
                      ) : null}
                      <ItemContent>
                        <ItemTitle>{banner.title || "Untitled banner"}</ItemTitle>
                        <ItemDescription>
                          {banner.is_active ? "Visible" : "Hidden"}
                          {banner.link_url ? ` · ${banner.link_url}` : ""}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <ToggleVisibilityButton
                          id={banner.id}
                          isActive={banner.is_active}
                        />
                        <Button
                          render={
                            <Link href={`/admin/dashboard/banners/${banner.id}/edit`} />
                          }
                          nativeButton={false}
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                        <DeleteBannerButton id={banner.id} />
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              )}
              <Button
                render={
                  <Link href={`/admin/dashboard/banners/new?slot=${slot}`} />
                }
                nativeButton={false}
                variant="outline"
              >
                Add {SLOT_LABELS[slot].toLowerCase().split(" ")[0]} banner
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}