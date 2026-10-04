/**
 * Locates the CLIP weights on local disk and points Transformers.js at them.
 *
 * Rationale (measured, not assumed): without a local copy, the first image
 * search on a cold server downloads ~89 MB from the Hugging Face Hub. That
 * measured 935 s here and 441 s on a faster connection — far beyond any
 * serverless request timeout, so the feature would fail on every cold start.
 * Loading the identical bytes from disk measured 1086 ms cold / 712 ms warm,
 * and produced bit-identical vectors (cosine 1.0000000000 against both the
 * download cache and the rows already stored in the database).
 *
 * `scripts/fetch-image-model-weights.ts` populates `models/`. When the
 * directory is absent we deliberately fall back to Transformers.js defaults so
 * a fresh checkout still works, just slowly. See docs/image-search.md.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { IMAGE_EMBEDDING_MODEL } from "./image-embeddings.ts";

/**
 * Root directory containing `<org>/<model>/...`, i.e. the parent of
 * `Xenova/clip-vit-base-patch32`.
 */
export const IMAGE_MODEL_ROOT = path.join(process.cwd(), "models");

/**
 * The directory holding the weight files, or `null` when they are not present.
 *
 * `existsSync` on the onnx file specifically: an empty or partially fetched
 * `models/` directory would otherwise resolve as valid and fail later inside
 * Transformers.js with a far less obvious error.
 */
export function resolveLocalModelDir(model: string = IMAGE_EMBEDDING_MODEL): string | null {
  const dir = path.join(IMAGE_MODEL_ROOT, model);
  return existsSync(path.join(dir, "onnx", "vision_model_quantized.onnx")) ? dir : null;
}

/**
 * Configure Transformers.js to read from `models/` and never touch the
 * network. Mutates the library's shared `env` singleton, so it must run before
 * the first pipeline load — which it does, since it is called from
 * `getExtractor()` immediately before `pipeline()`.
 *
 * Returns the directory in use, or `null` if the weights are missing and the
 * library's download fallback is being used.
 */
export async function configureImageModelSource(): Promise<string | null> {
  const { env } = await import("@huggingface/transformers");

  const localDir = resolveLocalModelDir();
  if (!localDir) {
    // Leave the defaults alone so a checkout without `models/` still works.
    return null;
  }

  env.cacheDir = null;
  env.useFSCache = false;
  env.useBrowserCache = false;
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  // Transformers.js appends `<org>/<model>` to this.
  env.localModelPath = IMAGE_MODEL_ROOT;

  return localDir;
}