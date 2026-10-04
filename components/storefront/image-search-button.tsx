"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  IMAGE_SEARCH_UPLOAD_FIELD,
  type ImageSearchResponse,
} from "@/lib/ai/image-search-config";
import { encodeImageResultToken } from "@/lib/ai/image-result-token";

type Status = "idle" | "searching" | "empty" | "error";

const ERROR_MESSAGE = "Couldn't search this image. Try another photo.";

/**
 * Camera action for the storefront search bar.
 *
 * `capture="environment"` asks mobile browsers to open the rear camera
 * directly; desktop browsers ignore it and fall back to the ordinary file
 * picker, so one control covers both.
 *
 * The selected photo is only ever held in a local object URL for the preview and
 * is discarded when the panel closes — it is posted once to /api/search/image,
 * which embeds it and keeps nothing.
 */
export function ImageSearchButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Tracked in a ref so the object URL can be revoked from cleanup even if the
  // component unmounts mid-search.
  const previewRef = useRef<string | null>(null);

  const clearPreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => clearPreview, [clearPreview]);

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage(null);
    clearPreview();
    if (inputRef.current) inputRef.current.value = "";
  }, [clearPreview]);

  const search = useCallback(
    async (file: File) => {
      setStatus("searching");
      setMessage(null);

      try {
        const body = new FormData();
        body.append(IMAGE_SEARCH_UPLOAD_FIELD, file);

        const response = await fetch("/api/search/image", { method: "POST", body });
        const payload = (await response.json().catch(() => null)) as
          | (ImageSearchResponse & { error?: string })
          | null;

        if (!response.ok) {
          setStatus("error");
          setMessage(payload?.error ?? ERROR_MESSAGE);
          return;
        }

        const results = payload?.results ?? [];
        if (results.length === 0) {
          setStatus("empty");
          return;
        }

        // Carry the active filters into the result page so they keep narrowing
        // the candidates. `q` is dropped: image search is its own mode, and the
        // result page describes itself as visually similar to the photo.
        const next = new URLSearchParams(searchParams.toString());
        next.set("img", encodeImageResultToken(results.map((r) => r.productId)));
        next.delete("q");
        next.delete("page");

        clearPreview();
        setStatus("idle");
        router.push(`/products?${next.toString()}`);
      } catch {
        setStatus("error");
        setMessage(ERROR_MESSAGE);
      }
    },
    [clearPreview, router, searchParams],
  );

  const onSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      clearPreview();
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setPreviewUrl(url);

      void search(file);
    },
    [clearPreview, search],
  );

  const searching = status === "searching";
  const open = status !== "idle";

  return (
    <div className="relative shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onSelect}
        tabIndex={-1}
        aria-hidden
      />

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="px-3"
        disabled={searching}
        aria-busy={searching}
        aria-label={searching ? "Searching for similar products" : "Search by image"}
        title="Search by image"
        onClick={() => inputRef.current?.click()}
      >
        {searching ? (
          <Spinner className="size-4" />
        ) : (
          <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-4" />
        )}
      </Button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-popover p-3 shadow-md">
          <div className="flex gap-3">
            {previewUrl && (
              // Blob URL of the local selection; never uploaded to storage.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Photo you selected"
                className="size-14 shrink-0 rounded-md border border-border object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              {status === "searching" && (
                <p className="text-sm text-foreground">Finding similar products...</p>
              )}

              {status === "empty" && (
                <>
                  <p className="text-sm text-foreground">No visually similar products found.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a photo with more of the product in frame.
                  </p>
                </>
              )}

              {status === "error" && (
                <>
                  <p className="text-sm text-foreground">{message ?? ERROR_MESSAGE}</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-primary"
                    onClick={() => inputRef.current?.click()}
                  >
                    Try another photo
                  </Button>
                </>
              )}
            </div>
          </div>

          {!searching && (
            <button
              type="button"
              onClick={reset}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}