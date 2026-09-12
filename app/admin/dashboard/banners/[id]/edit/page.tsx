import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BANNER_SLOTS, type BannerSlot } from "@/lib/admin/banner-slots";
import { createClient } from "@/lib/supabase/server";
import { BannerForm } from "../../banner-form";
import { updateBanner } from "@/lib/admin/banners";

type EditBannerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBannerPage({ params }: EditBannerPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: banner } = await supabase
    .from("home_banners")
    .select("id, slot, title, subtitle, link_url, image_path")
    .eq("id", id)
    .maybeSingle();
  if (!banner) {
    notFound();
  }

  const slot: BannerSlot = BANNER_SLOTS.includes(banner.slot as BannerSlot)
    ? (banner.slot as BannerSlot)
    : "hero";

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit banner</CardTitle>
          <CardDescription>
            Update the text, link, or replace the image.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BannerForm
            action={updateBanner}
            id={banner.id}
            slot={slot}
            title={banner.title ?? ""}
            subtitle={banner.subtitle ?? ""}
            linkUrl={banner.link_url ?? ""}
            imageKept={Boolean(banner.image_path)}
          />
        </CardContent>
      </Card>
    </div>
  );
}