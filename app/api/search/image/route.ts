import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupportedImageType, sniffImageType } from "@/lib/storage";
import {
  IMAGE_SEARCH_MAX_UPLOAD_BYTES,
  IMAGE_SEARCH_UPLOAD_FIELD,
  type ImageSearchResponse,
} from "@/lib/ai/image-search-config";
import { getImageEmbeddingViaService, ImageInferenceError } from "@/lib/ai/image-inference-client";
import { isImageSearchRateLimited } from "@/lib/ai/image-search-rate-limit";
import { findSimilarProducts, ImageSearchUnavailableError } from "@/lib/ai/search-products";

// The model runs in the external inference service (services/image-search/),
// so this route stays a thin validate -> embed -> pgvector-search proxy and the
// Vercel bundle never contains Transformers.js, ONNX, or model weights.
export const runtime = "nodejs";

export const maxDuration = 60;

const MB = 1024 * 1024;

function errorResponse(status: number, message: string, code: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Best-effort client identity for throttling. Trusts forwarding headers only as
 * a rate-limit key, never for authorization.
 */
function clientId(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  if (isImageSearchRateLimited(clientId(request))) {
    return errorResponse(
      429,
      "Too many image searches. Wait a moment and try again.",
      "rate_limited",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "Could not read that upload. Try another photo.", "bad_request");
  }

  const uploaded = form.get(IMAGE_SEARCH_UPLOAD_FIELD);
  if (!(uploaded instanceof File) || uploaded.size === 0) {
    return errorResponse(400, "Choose a photo to search with.", "missing_image");
  }

  // Size is checked before anything is decoded so an oversized payload cannot
  // reach CLIP. The multipart parser has already buffered it, which is why the
  // accepted ceiling matches the storage bucket's own 5 MB trigger.
  if (uploaded.size > IMAGE_SEARCH_MAX_UPLOAD_BYTES) {
    return errorResponse(
      413,
      `Photos must be under ${IMAGE_SEARCH_MAX_UPLOAD_BYTES / MB} MB. Try a smaller one.`,
      "image_too_large",
    );
  }

  // The declared MIME type is attacker-controlled, so the type is taken from the
  // magic bytes instead — the same check the product image upload path uses.
  const detected = await sniffImageType(uploaded);
  if (!isSupportedImageType(detected)) {
    return errorResponse(415, "Use a JPEG, PNG or WebP photo.", "unsupported_format");
  }

  const startedAt = Date.now();

  let embedding: number[];
  try {
    embedding = await getImageEmbeddingViaService(uploaded);
  } catch (err) {
    if (err instanceof ImageInferenceError) {
      console.error(`[image-search] inference failed (${err.code}): ${err.message}`);
      if (err.code === "rejected") {
        return errorResponse(422, "Couldn't read that photo. Try another one.", "embedding_failed");
      }
      if (err.code === "unavailable") {
        return errorResponse(503, "Image search is unavailable right now.", "search_unavailable");
      }
      return errorResponse(500, "Image search is unavailable right now.", "embedding_failed");
    }
    console.error("[image-search] unexpected embedding error:", err);
    return errorResponse(500, "Image search is unavailable right now.", "embedding_failed");
  }

  const embeddingMs = Date.now() - startedAt;

  try {
    // The request-scoped client: the storefront grid is public, so anonymous
    // buyers search under their anon grant on the SECURITY DEFINER RPC.
    const supabase = await createClient();
    const search = await findSimilarProducts(supabase, embedding);

    console.log(
      `[image-search] embed ${embeddingMs}ms, rpc ${search.rpcMs}ms, ${search.imageMatches} image matches, ${search.results.length} products`,
    );

    const body: ImageSearchResponse = { results: search.results };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof ImageSearchUnavailableError) {
      console.error(`[image-search] similarity RPC failed: ${err.message}`);
      return errorResponse(503, "Image search is unavailable right now.", "search_unavailable");
    }
    console.error("[image-search] unexpected search error:", err);
    return errorResponse(500, "Image search is unavailable right now.", "search_failed");
  }
}