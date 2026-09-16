"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { publicImageUrl } from "@/lib/storage";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

export type HomeBanner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  link_url: string | null;
  image_path: string;
};

const AUTOPLAY_MS = 5000;

export function HomeBannerCarousel({ banners }: { banners: HomeBanner[] }) {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  React.useEffect(() => {
    if (!api || banners.length < 2) return;
    const timer = setInterval(() => api.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [api, banners.length]);

  return (
    <div>
      <Carousel setApi={setApi} opts={{ loop: true, align: "start" }}>
        <CarouselContent className="-ml-0">
          {banners.map((banner) => {
            const slide = (
              <div className="relative h-56 w-full overflow-hidden rounded-lg border border-border bg-muted md:h-64">
                <Image
                  src={publicImageUrl("banners", banner.image_path)}
                  alt={banner.title ?? "Banner"}
                  fill
                  sizes="(min-width: 1280px) 1216px, 100vw"
                  className="object-cover"
                />
                {banner.title || banner.subtitle ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    {banner.title ? (
                      <p className="text-lg font-bold text-white">
                        {banner.title}
                      </p>
                    ) : null}
                    {banner.subtitle ? (
                      <p className="text-sm text-white/90">{banner.subtitle}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
            return (
              <CarouselItem key={banner.id} className="pl-0">
                {banner.link_url ? (
                  <Link href={banner.link_url}>{slide}</Link>
                ) : (
                  slide
                )}
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
      {banners.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === current
                  ? "w-5 bg-primary"
                  : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}