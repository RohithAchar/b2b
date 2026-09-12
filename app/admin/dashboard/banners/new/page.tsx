import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BANNER_SLOTS, type BannerSlot } from "@/lib/admin/banner-slots";
import { BannerForm } from "../banner-form";
import { createBanner } from "@/lib/admin/banners";

type NewBannerPageProps = {
  searchParams: Promise<{ slot?: string }>;
};

export default async function NewBannerPage({
  searchParams,
}: NewBannerPageProps) {
  const { slot } = await searchParams;
  const preselected: BannerSlot = BANNER_SLOTS.includes(slot as BannerSlot)
    ? (slot as BannerSlot)
    : "hero";

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Add banner</CardTitle>
          <CardDescription>
            It appears on the home page as soon as it&apos;s saved
            (until you hide it).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BannerForm
            action={createBanner}
            slot={preselected}
            imageRequired
          />
        </CardContent>
      </Card>
    </div>
  );
}