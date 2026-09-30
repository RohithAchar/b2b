"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSupportedImageType, sniffImageType } from "@/lib/storage";
import {
  EmbeddingError,
  IMAGE_EMBEDDING_MODEL,
  embedImageBytes,
  isImageSearchConfigured,
} from "@/lib/embeddings";

export type ImageSearchState = {
  ok: boolean;
  message: string;
};

/** Jina rejects images over 5MB; the storage trigger allows up to 50MB. */
const MAX_QUERY_IMAGE_BYTES = 5 * 1024 * 1024;

/** Recent queries kept per buyer, mirroring recordRecentlyViewed's history trim. */
const MAX_QUERIES_PER_BUYER = 20;

const searchByImageSchema = z.object({
  image: z.custom<File>((v) => v instanceof File, "No image selected."),
});

/**
 * Upload a reference image, embed it, and redirect to the visual results.
 *
 * The image bytes are never persisted: only the resulting vector is stored, in
 * public.image_search_queries, keyed by a uuid that travels in the URL. The
 * source image is deliberately discarded, which is why the results page cannot
 * show a thumbnail of what was searched.
 */
export async function searchByImage(
  _prev: ImageSearchState,
  formData: FormData,
): Promise<ImageSearchState> {
  const parsed = searchByImageSchema.safeParse({ image: formData.get("image") });
  if (!parsed.success) {
    return { ok: false, message: "Choose an image to search with." };
  }
  const file = parsed.data.image;

  if (!isImageSearchConfigured()) {
    return { ok: false, message: "Image search is not available right now." };
  }
  if (file.size === 0) {
    return { ok: false, message: "That image is empty." };
  }
  if (file.size > MAX_QUERY_IMAGE_BYTES) {
    return { ok: false, message: "Images must be 5MB or smaller." };
  }

  // The browser-supplied content type is untrusted; sniff the magic bytes.
  const sniffed = await sniffImageType(file);
  if (!sniffed || !isSupportedImageType(sniffed)) {
    return { ok: false, message: "Use a JPEG, PNG or WebP image." };
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return { ok: false, message: "Sign in to search by image." };
  }

  let vector: number[];
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    vector = await embedImageBytes(bytes, "retrieval.query");
  } catch (err) {
    console.error("searchByImage embedding failed:", (err as Error).message);
    return {
      ok: false,
      message:
        err instanceof EmbeddingError && err.status === 429
          ? "Image search is busy. Try again in a moment."
          : "Could not read that image. Try another one.",
    };
  }

  const { data: query, error: insertError } = await supabase
    .from("image_search_queries")
    .insert({
      buyer_id: user.id,
      model: IMAGE_EMBEDDING_MODEL,
      embedding: vector,
    })
    .select("id")
    .single();

  if (insertError || !query) {
    console.error("searchByImage insert failed:", insertError?.code, insertError?.message);
    return { ok: false, message: "Could not run that search. Try again." };
  }

  await pruneImageSearchQueries(supabase, user.id);

  revalidatePath("/products");
  redirect(`/products?img=${query.id}`);
}

/**
 * Drop this buyer's own expired queries and any beyond the retention limit.
 * Best-effort: a failed prune leaks a few vectors until the next search, and
 * must never turn a successful search into an error.
 */
async function pruneImageSearchQueries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  buyerId: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from("image_search_queries")
    .select("id, expires_at")
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const expired = rows.filter((r) => (r.expires_at as string) <= cutoff).map((r) => r.id as string);
  const overflow = rows
    .slice(MAX_QUERIES_PER_BUYER)
    .map((r) => r.id as string);
  const remove = [...new Set([...expired, ...overflow])];

  if (remove.length === 0) return;

  const { error } = await supabase
    .from("image_search_queries")
    .delete()
    .eq("buyer_id", buyerId)
    .in("id", remove);

  if (error) {
    console.error("pruneImageSearchQueries failed:", error.code, error.message);
  }
}
