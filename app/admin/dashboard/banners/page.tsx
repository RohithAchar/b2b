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

function BannerPreview({
  imagePath,
  title,
  subtitle,
  slot,
}: {
  imagePath: string;
  title: string | null;
  subtitle: string | null;
  slot: string;
}) {
  const media = (
    <div
      className={`relative w-full overflow-hidden rounded-lg bg-muted ${
        slot === "hero" ? "h-64" : "h-32"
      }`}
    >
      {imagePath !== "pending" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicImageUrl("banners", imagePath)}
            alt={title ?? "Banner"}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {title || subtitle ? (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              {title ? (
                <p className="text-lg font-semibold text-white">{title}</p>
              ) : null}
              {subtitle ? (
                <p className="text-sm text-white/90">{subtitle}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Image pending
        </div>
      )}
    </div>
  );
  return media;
}

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
            The images buyers see at the top of the storefront. Previews are
            shown at the exact size and ratio they appear on the home page.
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
                <div className="flex flex-col gap-4">
                  {banners.map((banner) => (
                    <div key={banner.id} className="flex flex-col gap-2">
                      <Badge
                        variant={banner.is_active ? "default" : "outline"}
                        className="w-fit"
                      >
                        {banner.is_active ? "Visible" : "Hidden"}
                      </Badge>
                      <BannerPreview
                        imagePath={banner.image_path}
                        title={banner.title}
                        subtitle={banner.subtitle}
                        slot={banner.slot}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium">
                            {banner.title || "Untitled banner"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {banner.link_url ? `Links to ${banner.link_url}` : "No link"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ToggleVisibilityButton
                            id={banner.id}
                            isActive={banner.is_active}
                          />
                          <Button
                            render={
                              <Link
                                href={`/admin/dashboard/banners/${banner.id}/edit`}
                              />
                            }
                            nativeButton={false}
                            variant="outline"
                            size="sm"
                          >
                            Edit
                          </Button>
                          <DeleteBannerButton id={banner.id} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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