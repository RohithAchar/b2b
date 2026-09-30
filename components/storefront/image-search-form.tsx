"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { SearchVisualIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { searchByImage, type ImageSearchState } from "@/lib/buyer/image-search-action";

const initialState: ImageSearchState = { ok: false, message: "" };

/** Jina rejects images over 5MB; checked client-side to avoid a wasted upload. */
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

function CameraButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      disabled={pending || disabled}
      className="shrink-0"
    >
      <HugeiconsIcon icon={SearchVisualIcon} strokeWidth={2} />
      {pending ? "Searching…" : "Search by image"}
    </Button>
  );
}

/**
 * Image-search entry point. Submits the picked file to the `searchByImage`
 * server action, which embeds it and redirects to /products?img=<uuid>.
 *
 * Renders next to the text search form rather than inside it: the text form is
 * a plain GET form to /products, and nesting a second form would break the
 * browser's one-form-per-parent rule.
 */
export function ImageSearchForm() {
  const [state, formAction] = useActionState(searchByImage, initialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const error = localError ?? (state.ok ? null : state.message || null);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          name="image"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            setLocalError(null);
            if (!file) {
              setFileName(null);
              return;
            }
            if (file.size > MAX_BYTES) {
              setLocalError("Images must be 5MB or smaller.");
              setFileName(null);
              // Clear the selection so choosing the same file again re-triggers.
              event.currentTarget.value = "";
              return;
            }
            setFileName(file.name);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => inputRef.current?.click()}
        >
          <HugeiconsIcon icon={SearchVisualIcon} strokeWidth={2} />
          {fileName ?? "Choose an image"}
        </Button>
        <CameraButton disabled={!fileName} />
      </form>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
