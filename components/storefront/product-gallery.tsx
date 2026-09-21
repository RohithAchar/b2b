"use client";

import { useState } from "react";
import Image from "next/image";
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
    <div className="lg:sticky lg:top-4 lg:self-start">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-card">
        {images.length > 0 ? (
          <Image
            src={publicImageUrl("product_images", images[active].path)}
            alt={images[active].alt ?? title}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
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
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={`relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted ${
                i === active
                  ? "border-primary"
                  : "border-transparent hover:border-border"
              }`}
            >
              <Image
                src={publicImageUrl("product_images", img.path)}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}