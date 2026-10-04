/**
 * CLIP image embeddings, computed locally with Transformers.js on the Node.js
 * runtime. No external vision API is involved.
 *
 * Server-only by construction: the Transformers.js import is dynamic and
 * happens inside getExtractor(), so nothing in this module executes at import
 * time and `next build` never touches the model. The runtime guard below is a
 * backstop for the case where this file is accidentally reached from a client
 * bundle, where `sharp`/onnxruntime-node are unavailable anyway.
 *
 * Keep this module free of imports from app/client code.
 */

import { configureImageModelSource } from "./image-model-source.ts";
import {
  IMAGE_EMBEDDING_DIM,
  IMAGE_EMBEDDING_DTYPE,
  IMAGE_EMBEDDING_MODEL,
} from "./image-embedding-model.ts";

export { IMAGE_EMBEDDING_DIM, IMAGE_EMBEDDING_DTYPE, IMAGE_EMBEDDING_MODEL };

export class ImageEmbeddingError extends Error {
  // Declared rather than a constructor parameter property: this module is also
  // loaded by scripts/backfill-product-image-embeddings.ts through Node's
  // native TypeScript support, whose strip-only mode rejects parameter
  // properties (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX).
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ImageEmbeddingError";
    this.cause = cause;
  }
}

/**
 * Minimal shape of the Transformers.js pipeline we use. Declared locally
 * rather than imported so that this module's types resolve without pulling the
 * Transformers.js type graph into every consumer.
 */
type FeatureExtractor = (image: Blob) => Promise<{ tolist(): number[] | number[][] }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;

/**
 * One pipeline per Node.js process. The promise is cached rather than the
 * resolved value so concurrent first requests share a single load; a failed
 * load clears the cache so the next request retries instead of replaying a
 * rejected promise forever.
 */
async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      if (typeof window !== "undefined") {
        throw new ImageEmbeddingError("Image embeddings are only available on the server.");
      }

      // Prefer the vendored weights in `models/`. Without them the first load
      // downloads ~89 MB, which measured 935 s and times out on serverless.
      const localDir = await configureImageModelSource();

      const { pipeline } = await import("@huggingface/transformers");
      const extractor = (await pipeline("image-feature-extraction", IMAGE_EMBEDDING_MODEL, {
        dtype: IMAGE_EMBEDDING_DTYPE,
      })) as unknown as FeatureExtractor;

      console.info(
        `[image-search] model ready (${localDir ? "local" : "downloaded"}): ` +
          `${IMAGE_EMBEDDING_MODEL} ${IMAGE_EMBEDDING_DTYPE}`,
      );
      return extractor;
    })().catch((err: unknown) => {
      extractorPromise = null;
      throw new ImageEmbeddingError("Could not load the image search model.", err);
    });
  }
  return extractorPromise;
}

/**
 * Normalise to unit length. Transformers.js returns CLIP's projected image
 * embedding raw; measured L2 norm is around 11, so cosine distance is only
 * meaningful after this step. Unit vectors also let pgvector's
 * `<=>` cosine distance be read as plain Euclidean distance.
 */
export function normalizeVector(values: readonly number[]): number[] {
  let sumSquares = 0;
  for (const v of values) sumSquares += v * v;

  const norm = Math.sqrt(sumSquares);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new ImageEmbeddingError("Image search produced an unusable vector.");
  }

  return Array.from(values, (v) => v / norm);
}

/**
 * Embed a single image into a unit-length IMAGE_EMBEDDING_DIM vector.
 *
 * The image is decoded and discarded; nothing about it is retained.
 */
export async function getImageEmbedding(image: Blob): Promise<number[]> {
  const extractor = await getExtractor();

  let output: { tolist(): number[] | number[][] };
  try {
    output = await extractor(image);
  } catch (err) {
    throw new ImageEmbeddingError("Could not read that image. Try a different photo.", err);
  }

  const batched = output.tolist();

  // A [1, 512] tensor flattens to [[...]]; accept an already-flat [512] too.
  // Any other shape lands on a length that is not 512 and is rejected below.
  const vector: number[] = [];
  for (const entry of batched) {
    if (Array.isArray(entry)) vector.push(...entry);
    else vector.push(entry);
  }

  if (vector.length !== IMAGE_EMBEDDING_DIM) {
    throw new ImageEmbeddingError(
      `Expected a ${IMAGE_EMBEDDING_DIM}-dimension embedding, got ${vector.length}.`,
    );
  }
  if (vector.some((v) => !Number.isFinite(v))) {
    throw new ImageEmbeddingError("Image search produced a malformed embedding.");
  }

  return normalizeVector(vector);
}

/** True once the model is resident, i.e. a call will not pay the load cost. */
export function isImageEmbeddingModelWarm(): boolean {
  return extractorPromise !== null;
}

/** Test seam: drops the cached pipeline. */
export function resetImageEmbeddingModel(): void {
  extractorPromise = null;
}