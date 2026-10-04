/**
 * Client for the external CLIP inference service (services/image-search/).
 *
 * The Vercel app never loads the model. It POSTs the already-validated upload
 * here and receives a normalized IMAGE_EMBEDDING_DIM vector, which the caller
 * passes into the existing Supabase similarity search. The service URL/token
 * are server-only env vars, never exposed to the browser.
 */

import { IMAGE_EMBEDDING_DIM, IMAGE_EMBEDDING_MODEL } from "./image-embedding-model";

export const IMAGE_INFERENCE_TIMEOUT_MS = 25_000;

export class ImageInferenceError extends Error {
  readonly code: "config" | "unauthorized" | "rejected" | "unavailable" | "invalid";
  readonly status: number;
  readonly cause?: unknown;

  constructor(
    code: ImageInferenceError["code"],
    status: number,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ImageInferenceError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

type ServiceSuccess = { embedding: unknown; model?: unknown; dim?: unknown };

function isValidEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === IMAGE_EMBEDDING_DIM &&
    value.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

function serviceUrl(): string {
  const base = process.env.IMAGE_SEARCH_SERVICE_URL?.trim().replace(/\/+$/, "");
  if (!base) {
    throw new ImageInferenceError("config", 500, "Image search is not configured.");
  }
  return `${base}/embed`;
}

/**
 * Send image bytes to the inference service and return the normalized embedding.
 */
export async function getImageEmbeddingViaService(image: Blob): Promise<number[]> {
  const token = process.env.IMAGE_SEARCH_SERVICE_TOKEN;
  if (!process.env.IMAGE_SEARCH_SERVICE_URL?.trim() || !token) {
    throw new ImageInferenceError("config", 500, "Image search is not configured.");
  }

  const form = new FormData();
  form.append("image", image, "upload");

  let response: Response;
  try {
    response = await fetch(serviceUrl(), {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(IMAGE_INFERENCE_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ImageInferenceError(
      "unavailable",
      503,
      "Image search is unavailable right now.",
      err,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ImageInferenceError(
      "unauthorized",
      500,
      "Image search is unavailable right now.",
    );
  }
  if (!response.ok) {
    const retryable = response.status >= 500 || response.status === 429;
    throw new ImageInferenceError(
      retryable ? "unavailable" : "rejected",
      response.status,
      "Image search is unavailable right now.",
    );
  }

  let body: ServiceSuccess;
  try {
    body = (await response.json()) as ServiceSuccess;
  } catch (err) {
    throw new ImageInferenceError("invalid", 500, "Bad inference response.", err);
  }

  if (!isValidEmbedding(body.embedding)) {
    throw new ImageInferenceError("invalid", 500, "Bad inference response.");
  }
  if (body.model !== undefined && body.model !== IMAGE_EMBEDDING_MODEL) {
    throw new ImageInferenceError("invalid", 500, "Inference model mismatch.");
  }
  if (body.dim !== undefined && body.dim !== IMAGE_EMBEDDING_DIM) {
    throw new ImageInferenceError("invalid", 500, "Inference dimension mismatch.");
  }

  return body.embedding;
}
