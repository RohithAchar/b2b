/**
 * Fetch the CLIP image-search weights into `models/` so the server never has to
 * download them at runtime.
 *
 * Why this exists: with no local copy, the first image search on a cold server
 * downloads ~89 MB from the Hugging Face Hub. Measured at 935 s on the machine
 * this was written on, which blows through any serverless request timeout.
 * Reading the same weights from disk costs ~1.1 s. See docs/image-search.md.
 *
 * Run via `pnpm embeddings:fetch-model`. Three sources, cheapest first:
 *
 *   1. `models/` already populated  -> no-op
 *   2. the Transformers.js cache    -> copy, instant, no network
 *   3. the Hugging Face Hub         -> download
 *
 * Not wired into `next build`, which must stay free of network calls and must
 * never load the model. `prebuild` runs this so a deployment cannot ship
 * without weights.
 */

import { createWriteStream, existsSync, statSync } from "node:fs";
import { copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const MODEL = "Xenova/clip-vit-base-patch32";

/** Only the files a vision-only `image-feature-extraction` pipeline reads. */
const FILES = [
  "config.json",
  "preprocessor_config.json",
  "onnx/vision_model_quantized.onnx",
] as const;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST_ROOT = path.join(REPO_ROOT, "models");

/** Transformers.js caches downloads beside its own install directory. */
const CACHE_ROOT = path.join(REPO_ROOT, "node_modules", "@huggingface", "transformers", ".cache");

function destPath(rel: string): string {
  return path.join(DEST_ROOT, MODEL, rel);
}

function sizeOf(p: string): number | null {
  try {
    return statSync(p).size;
  } catch {
    return null;
  }
}

function allPresent(root: string): boolean {
  return FILES.every((rel) => {
    const size = sizeOf(path.join(root, rel));
    return size !== null && size > 0;
  });
}

function formatBytes(bytes: number): string {
  return bytes >= 1 << 20 ? `${(bytes / (1 << 20)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

async function copyFromCache(): Promise<boolean> {
  if (!existsSync(CACHE_ROOT) || !allPresent(path.join(CACHE_ROOT, MODEL))) return false;

  console.log(`[model] copying from the Transformers.js cache: ${CACHE_ROOT}`);
  for (const rel of FILES) {
    const to = destPath(rel);
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(path.join(CACHE_ROOT, MODEL, rel), to);
    console.log(`[model]   ${rel} (${formatBytes((await stat(to)).size)})`);
  }
  return true;
}

async function download(): Promise<void> {
  console.log(`[model] downloading ${MODEL} from the Hugging Face Hub`);
  for (const rel of FILES) {
    const to = destPath(rel);
    await mkdir(path.dirname(to), { recursive: true });

    const res = await fetch(`https://huggingface.co/${MODEL}/resolve/main/${rel}`, {
      redirect: "follow",
    });
    if (!res.ok || !res.body) throw new Error(`download failed for ${rel}: HTTP ${res.status}`);

    // Write to a temp file and rename, so an interrupted run never leaves a
    // truncated file that a later run mistakes for a complete one.
    const tmp = `${to}.partial`;
    try {
      await streamPipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
      await unlink(to).catch(() => {});
      await rename(tmp, to);
    } catch (err) {
      await unlink(tmp).catch(() => {});
      throw err;
    }

    console.log(`[model]   ${rel} (${formatBytes((await stat(to)).size)})`);
  }
}

async function main(): Promise<void> {
  if (allPresent(DEST_ROOT + "/" + MODEL)) {
    console.log(`[model] already present at ${path.join(DEST_ROOT, MODEL)} — nothing to do`);
    return;
  }

  if (!(await copyFromCache())) await download();

  if (!allPresent(path.join(DEST_ROOT, MODEL))) {
    throw new Error(`weights are still incomplete at ${path.join(DEST_ROOT, MODEL)}`);
  }

  const total = FILES.reduce((sum, rel) => sum + sizeOf(destPath(rel))!, 0);
  console.log(`[model] done — ${formatBytes(total)} across ${FILES.length} files`);
}

await main();