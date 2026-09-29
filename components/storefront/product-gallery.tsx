"use client";

import { useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { publicImageUrl } from "@/lib/storage";

export type GalleryImage = {
  id: string;
  path: string;
  sort: number;
  alt: string | null;
};

export function ProductGallery({
  images,
  title,
  negotiable,
}: {
  images: GalleryImage[];
  title: string;
  negotiable: boolean;
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      {/* Main image first in the DOM (mobile order), thumbnails pulled to the
          left rail on desktop via `lg:order-first`. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="relative mx-auto aspect-square w-full max-w-[500px] overflow-hidden rounded-lg border border-border bg-muted lg:mx-0">
          {images.length > 0 ? (
            <Image
              src={publicImageUrl("product_images", images[active].path)}
              alt={images[active].alt ?? title}
              fill
              priority
              sizes="(min-width: 1024px) 500px, 100vw"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
          {negotiable && (
            <span className="absolute left-3 top-3 rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
              Negotiable
            </span>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1 lg:order-first lg:max-h-[500px] lg:w-16 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:pb-0">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === active}
                className={`relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                  i === active
                    ? "border-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Image
                  src={publicImageUrl("product_images", img.path)}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
                {i === active && (
                  <span className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                    <span className="sr-only">Selected</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
