import sharp from "sharp";

/**
 * Multimodal image embeddings for search-by-image.
 *
 * Pinned to one model on purpose: vectors from different models are not
 * comparable, so every row in product_image_embeddings / image_search_queries
 * stores its `model` and the ranking RPC only ever compares rows that share
 * one. Changing IMAGE_EMBEDDING_MODEL requires a full re-index via
 * scripts/backfill-image-embeddings.mjs, not just new rows.
 *
 * IMAGE_EMBEDDING_DIM must match the `extensions.vector(...)` column width in
 * supabase/migrations/20260930120000_add_image_search.sql.
 */
export const IMAGE_EMBEDDING_MODEL = "jina-embeddings-v5-omni-small";
export const IMAGE_EMBEDDING_DIM = 1024;

const EMBEDDING_URL = "https://api.jina.ai/v1/embeddings";

/** Query/passage is asymmetric; using the wrong side measurably degrades results. */
export type EmbeddingTask = "retrieval.query" | "retrieval.passage";

/**
 * Jina rejects images over 5MB. Product/query images are downscaled well below
 * that, which also keeps a query upload cheap on the free tier (a 600x600
 * image costs ~363 tokens on v5-omni-small).
 */
const EMBED_MAX_EDGE_PX = 1024;
const EMBED_JPEG_QUALITY = 82;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 8_000;

export class EmbeddingError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "EmbeddingError";
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.JINA_API_KEY;
  if (!key) {
    throw new EmbeddingError("JINA_API_KEY is not configured.");
  }
  return key;
}

/** False when no key is present, so callers can degrade instead of erroring. */
export function isImageSearchConfigured(): boolean {
  return Boolean(process.env.JINA_API_KEY);
}

interface EmbeddingResponseItem {
  index: number;
  embedding: number[];
}

interface EmbeddingResponse {
  data: EmbeddingResponseItem[];
  usage?: { total_tokens?: number; image_tokens?: number | null };
}

function backoffDelayMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, BACKOFF_CAP_MS);
    }
  }
  const exponential = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CAP_MS);
  return exponential / 2 + Math.random() * (exponential / 2);
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.slice(0, 300);
  } catch {
    return "";
  }
}

/**
 * One request for up to `inputs`. `image` is either an absolute https URL or a
 * `data:` URI. Returns vectors in the same order as the inputs.
 */
async function requestEmbeddings(
  images: string[],
  task: EmbeddingTask,
  signal?: AbortSignal,
): Promise<{ vectors: number[][]; totalTokens: number }> {
  let lastError: EmbeddingError | null = null;
  let retryAfter: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt - 1, retryAfter)));
    }
    retryAfter = null;

    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(EMBEDDING_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey()}`,
        },
        body: JSON.stringify({
          model: IMAGE_EMBEDDING_MODEL,
          input: images.map((image) => ({ image })),
          dimensions: IMAGE_EMBEDDING_DIM,
          normalized: true,
          embedding_type: "float",
          task,
        }),
        signal: combined,
        cache: "no-store",
      });
    } catch (err) {
      // AbortError, DNS, connection reset. Retryable.
      if (combined.aborted && !signal?.aborted) {
        lastError = new EmbeddingError(`Embedding request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
      } else if (signal?.aborted) {
        throw err;
      } else {
        lastError = new EmbeddingError(`Embedding request failed: ${(err as Error).message}`);
      }
      continue;
    }

    if (response.ok) {
      const json = (await response.json()) as EmbeddingResponse;
      const data = json.data ?? [];
      if (data.length !== images.length) {
        throw new EmbeddingError(
          `Embedding response returned ${data.length} vectors for ${images.length} inputs.`,
        );
      }
      // `index` is documented but sort defensively: a reordering would silently
      // attach a vector to the wrong product.
      const ordered = [...data].sort((a, b) => a.index - b.index);
      for (const item of ordered) {
        if (!Array.isArray(item.embedding) || item.embedding.length !== IMAGE_EMBEDDING_DIM) {
          throw new EmbeddingError(
            `Embedding response had unexpected dimension; expected ${IMAGE_EMBEDDING_DIM}.`,
          );
        }
      }
      return {
        vectors: ordered.map((item) => item.embedding),
        totalTokens: json.usage?.total_tokens ?? 0,
      };
    }

    const body = await readErrorBody(response);
    lastError = new EmbeddingError(
      `Embedding API ${response.status}: ${body || response.statusText}`,
      response.status,
    );

    // 4xx other than 429 will not succeed on retry (bad key, bad input, too large).
    if (response.status < 500 && response.status !== 429) {
      throw lastError;
    }
    retryAfter = response.headers.get("retry-after");
  }

  throw lastError ?? new EmbeddingError("Embedding request failed.");
}

/**
 * Embed a batch of images, splitting into `batchSize` requests.
 * A failure anywhere rejects the whole batch: partial results would leave the
 * caller unsure which products actually got indexed.
 */
export async function embedImageBatch(
  images: string[],
  task: EmbeddingTask,
  options: { batchSize?: number; signal?: AbortSignal } = {},
): Promise<number[][]> {
  if (images.length === 0) return [];
  const batchSize = Math.max(1, options.batchSize ?? 16);
  const vectors: number[][] = [];

  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    const result = await requestEmbeddings(batch, task, options.signal);
    vectors.push(...result.vectors);
  }
  return vectors;
}

export async function embedImageUrl(
  url: string,
  task: EmbeddingTask,
  signal?: AbortSignal,
): Promise<number[]> {
  const [vector] = await embedImageBatch([url], task, { signal });
  if (!vector) throw new EmbeddingError("Embedding API returned no vector.");
  return vector;
}

/**
 * Normalize an uploaded image before embedding: apply EXIF orientation, bound
 * the longest edge, and re-encode as baseline JPEG. Dropping the original
 * metadata matters — a photo straight off a phone carries an orientation flag
 * that the provider would otherwise have to guess at.
 */
export async function toEmbeddableDataUri(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new EmbeddingError("Image is larger than 5MB.");
  }
  const jpeg = await sharp(bytes)
    .rotate()
    .resize(EMBED_MAX_EDGE_PX, EMBED_MAX_EDGE_PX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: EMBED_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** Convenience for a user upload: bytes -> validated data URI -> one vector. */
export async function embedImageBytes(
  bytes: Uint8Array,
  task: EmbeddingTask = "retrieval.query",
  signal?: AbortSignal,
): Promise<number[]> {
  return embedImageUrl(await toEmbeddableDataUri(bytes), task, signal);
}
