import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  configureImageModelSource,
  IMAGE_MODEL_ROOT,
  resolveLocalModelDir,
} from "../lib/ai/image-model-source";
import {
  getImageEmbedding,
  IMAGE_EMBEDDING_DIM,
  IMAGE_EMBEDDING_MODEL,
  ImageEmbeddingError,
  isImageEmbeddingModelWarm,
  normalizeVector,
  resetImageEmbeddingModel,
} from "../lib/ai/image-embeddings";

/**
 * Real CLIP inference.
 *
 * This downloads ~89 MB of quantised weights on first run, and a cold load was
 * measured at ~440 s on this machine, so it is opt-in:
 *
 *   IMAGE_SEARCH_MODEL_TESTS=1 pnpm vitest run tests/image-embeddings.test.ts
 *
 * Everything below the gate uses real inference on real pixels. Nothing is
 * mocked — there is no value in a test that stubs the model it exists to check.
 *
 * `sharp` generates the fixture pixels in-process so no image binaries need to
 * be committed to the repo.
 */

// A cold load dominates the runtime of every test in this file.
const COLD_LOAD_BUDGET_MS = 900_000;

// A warm inference is ~100 ms. Anything near the cold-load figure would mean
// the pipeline was re-created instead of reused, which this is here to catch.
const WARM_INFERENCE_BUDGET_MS = 15_000;

const enabled = process.env.IMAGE_SEARCH_MODEL_TESTS === "1";

if (!enabled) {
  console.log(
    "[image-embeddings] Real-inference tests skipped. Re-run with IMAGE_SEARCH_MODEL_TESTS=1 to download the model and exercise CLIP.",
  );
}

const SIZE = 224;

/** Solid red / white horizontal banding. */
async function stripedImage(stripeWidth: number): Promise<Blob> {
  const pixels = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y += 1) {
    const onRed = Math.floor(y / stripeWidth) % 2 === 0;
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 3;
      pixels[offset] = onRed ? 220 : 250;
      pixels[offset + 1] = onRed ? 30 : 250;
      pixels[offset + 2] = onRed ? 30 : 250;
    }
  }
  return toJpegBlob(pixels);
}

/** Diagonal green / blue banding — visually unrelated to the red stripes. */
async function diagonalImage(): Promise<Blob> {
  const pixels = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 3;
      const onGreen = Math.floor((x + y) / 16) % 2 === 0;
      pixels[offset] = onGreen ? 20 : 10;
      pixels[offset + 1] = onGreen ? 200 : 20;
      pixels[offset + 2] = onGreen ? 20 : 190;
    }
  }
  return toJpegBlob(pixels);
}

async function toJpegBlob(pixels: Buffer): Promise<Blob> {
  const jpeg = await sharp(pixels, {
    raw: { width: SIZE, height: SIZE, channels: 3 },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  return new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" });
}

function dot(a: readonly number[], b: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += a[i] * b[i];
  return total;
}

function l2Norm(vector: readonly number[]): number {
  return Math.sqrt(dot(vector, vector));
}

// ---------------------------------------------------------------------------
// Constants — cheap, and always run. They are the contract the migration's
// vector(512) column and the RPC's p_model default are written against.
// ---------------------------------------------------------------------------

describe("image embedding constants", () => {
  it("pins CLIP ViT-B/32 at 512 dimensions", () => {
    expect(IMAGE_EMBEDDING_MODEL).toBe("Xenova/clip-vit-base-patch32");
    expect(IMAGE_EMBEDDING_DIM).toBe(512);
  });
});

// ---------------------------------------------------------------------------
// normalizeVector — pure maths, no model needed, so this runs unconditionally.
// ---------------------------------------------------------------------------

describe("normalizeVector", () => {
  it("scales a vector to unit length", () => {
    const normalized = normalizeVector([3, 4]);
    expect(normalized[0]).toBeCloseTo(0.6, 10);
    expect(normalized[1]).toBeCloseTo(0.8, 10);
  });

  it("keeps a large-magnitude vector finite", () => {
    // CLIP's raw projection norm measures around 11, so this is the real case.
    const raw = Array.from({ length: 512 }, (_, i) => Math.sin(i) * 11);
    const normalized = normalizeVector(raw);
    expect(l2Norm(normalized)).toBeCloseTo(1, 10);
  });

  it("rejects a zero vector rather than dividing by zero", () => {
    expect(() => normalizeVector(Array.from({ length: 512 }, () => 0))).toThrow(ImageEmbeddingError);
  });

  it("rejects a non-finite vector", () => {
    expect(() => normalizeVector([Number.NaN, 1, 2])).toThrow(ImageEmbeddingError);
  });
});

// ---------------------------------------------------------------------------
// Model source — pure path resolution, no model needed, always runs.
// ---------------------------------------------------------------------------

describe("image model source", () => {
  it("resolves models/<org>/<model> when the weights are vendored", () => {
    const dir = resolveLocalModelDir();
    // Populated by `pnpm embeddings:fetch-model`, which `prebuild` runs. When
    // absent, the loader deliberately falls back to downloading.
    expect(dir === null || dir.endsWith(join("models", IMAGE_EMBEDDING_MODEL))).toBe(true);
  });

  it("returns null for a model that has not been fetched", () => {
    expect(resolveLocalModelDir("Xenova/definitely-not-a-real-model")).toBeNull();
  });

  it("never points at a directory outside models/", () => {
    const dir = resolveLocalModelDir();
    expect(dir === null || dir.startsWith(resolve(process.cwd(), "models"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Native dependencies — the Vercel failure this guards against. Nothing here
// downloads a model: `sharp` and `onnxruntime-node` are loaded for their
// side effect of binding, and the model source is only *resolved*.
// ---------------------------------------------------------------------------

describe("image search native dependencies", () => {
  it("binds libvips, which fails with ERR_DLOPEN_FAILED when its .so is absent", () => {
    // A deployed function whose trace omitted `libvips-cpp.so.<version>` throws
    // `Could not load the "sharp" module using the linux-x64 runtime` on the
    // first image search, long after the request reached the endpoint.
    expect(sharp.versions.vips).toEqual(expect.any(String));
    expect(sharp.versions.vips.length).toBeGreaterThan(0);
  });

  it("binds the ONNX runtime", async () => {
    // The binding is required through a template literal, so a deployed function
    // that did not trace it fails here instead, on the first inference.
    //
    // Resolved from Transformers.js rather than by package name: pnpm keeps
    // `onnxruntime-node` next to its single dependent, so only the import path
    // Transformers.js itself uses finds it.
    const requireFromTransformers = createRequire(
      createRequire(import.meta.url).resolve("@huggingface/transformers"),
    );
    const ort = requireFromTransformers("onnxruntime-node");

    expect(ort.InferenceSession).toBeTypeOf("function");
  });

  it("points the library at models/ and forbids remote fetches", async () => {
    const dir = await configureImageModelSource();
    const { env } = await import("@huggingface/transformers");

    if (dir === null) {
      // No vendored weights in this checkout: the download fallback stays legal.
      return;
    }
    // The whole point of vendoring: a cold start must not reach the Hub.
    expect(env.allowRemoteModels).toBe(false);
    expect(env.localModelPath).toBe(IMAGE_MODEL_ROOT);
    expect(env.useFSCache).toBe(false);
  });
});

/**
 * What actually reaches the deployed function. The two checks above also pass on
 * a developer machine, where `node_modules` is complete and nothing is traced;
 * this one reads the build output, so it is the only check that notices when a
 * native binary stops being shipped. Skipped when there is no build to inspect.
 */
const SEARCH_ROUTE_TRACE = resolve(
  process.cwd(),
  ".next/server/app/api/search/image/route.js.nft.json",
);

describe.skipIf(!existsSync(SEARCH_ROUTE_TRACE))("deployed image search function", () => {
  const tracedFiles: string[] = JSON.parse(readFileSync(SEARCH_ROUTE_TRACE, "utf8")).files;

  it("ships the CLIP weights rather than downloading them", () => {
    expect(tracedFiles.some((file) => file.includes("clip-vit-base-patch32/onnx/"))).toBe(true);
  });

  it.each([
    ["sharp's libvips", /libvips-cpp\.so\./],
    ["onnxruntime-node's package.json", /onnxruntime-node\/package\.json$/],
    ["onnxruntime-node's JavaScript", /onnxruntime-node\/dist\/index\.js$/],
    ["onnxruntime-node's binding", /onnxruntime_binding\.node$/],
    ["onnxruntime-node's CPU library", /libonnxruntime\.so\.1$/],
  ])("ships %s", (_label, pattern) => {
    expect(tracedFiles.some((file) => pattern.test(file))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Real inference — gated.
// ---------------------------------------------------------------------------

describe.skipIf(!enabled)("CLIP image embeddings (real inference)", () => {
  let stripes: Blob;
  let stripesWide: Blob;
  let diagonals: Blob;

  beforeAll(async () => {
    stripes = await stripedImage(8);
    stripesWide = await stripedImage(32);
    diagonals = await diagonalImage();
  });

  afterAll(() => {
    resetImageEmbeddingModel();
  });

  it(
    "returns a finite, unit-length 512-dimension vector",
    async () => {
      const embedding = await getImageEmbedding(stripes);

      expect(embedding).toHaveLength(IMAGE_EMBEDDING_DIM);
      expect(embedding.every((v) => Number.isFinite(v))).toBe(true);
      // Normalisation is what makes pgvector's cosine operator meaningful, so
      // this is asserted rather than assumed.
      expect(l2Norm(embedding)).toBeCloseTo(1, 6);
    },
    COLD_LOAD_BUDGET_MS,
  );

  it(
    "is deterministic for identical input",
    async () => {
      const first = await getImageEmbedding(stripes);
      const second = await getImageEmbedding(stripes);

      expect(second).toEqual(first);
    },
    COLD_LOAD_BUDGET_MS,
  );

  it(
    "separates visually different images",
    async () => {
      const a = await getImageEmbedding(stripes);
      const b = await getImageEmbedding(diagonals);
      const c = await getImageEmbedding(stripesWide);

      // Not a similarity-quality assertion: CLIP cosine scores on near-stock
      // patterns sit high (two unrelated generated images measured ~0.91), so
      // only "these are genuinely different vectors" is safe to require.
      expect(dot(a, b)).toBeLessThan(0.999);
      expect(dot(a, c)).toBeLessThan(0.999);
    },
    COLD_LOAD_BUDGET_MS,
  );

  it(
    "reuses the cached pipeline rather than reloading it",
    async () => {
      // Every earlier test has already loaded the model, so a load here would
      // mean the singleton regressed into per-call construction.
      expect(isImageEmbeddingModelWarm()).toBe(true);

      const startedAt = Date.now();
      await getImageEmbedding(stripes);
      const elapsed = Date.now() - startedAt;

      // A reload costs seconds-to-minutes even from the on-disk cache; warm
      // inference is ~100 ms.
      expect(elapsed).toBeLessThan(WARM_INFERENCE_BUDGET_MS);
    },
    COLD_LOAD_BUDGET_MS,
  );

  it(
    "reports the model as not warm until something is embedded",
    async () => {
      resetImageEmbeddingModel();
      expect(isImageEmbeddingModelWarm()).toBe(false);

      await getImageEmbedding(stripes);

      expect(isImageEmbeddingModelWarm()).toBe(true);
    },
    COLD_LOAD_BUDGET_MS,
  );

  it(
    "rejects bytes that are not a decodable image",
    async () => {
      // Magic-byte validation happens before this module; the model has to
      // defend itself anyway for a Blob that reached it by another route.
      const garbage = new Blob([new Uint8Array(64).fill(7)], { type: "image/jpeg" });

      await expect(getImageEmbedding(garbage)).rejects.toThrow(ImageEmbeddingError);
    },
    COLD_LOAD_BUDGET_MS,
  );
});