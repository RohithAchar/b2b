import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IMAGE_EMBEDDING_DIM,
  IMAGE_EMBEDDING_MODEL,
} from "../lib/embeddings";

const REPO_ROOT = join(__dirname, "..");

/**
 * The vector column width in the migration and the model used by the backfill
 * script are both duplicated from lib/embeddings.ts. If any of the three
 * disagree, embeddings silently become unroutable or incomparable, so pin them
 * here rather than letting the drift reach production.
 */
describe("image search constants stay in sync", () => {
  const migration = readFileSync(
    join(REPO_ROOT, "supabase/migrations/20260930120000_add_image_search.sql"),
    "utf8",
  );
  const backfill = readFileSync(
    join(REPO_ROOT, "scripts/backfill-image-embeddings.mjs"),
    "utf8",
  );

  it("uses a production-licensed model", () => {
    // jina-embeddings-v4 is free only under the Qwen Research License
    // (research/non-commercial) and is not suitable for production.
    expect(IMAGE_EMBEDDING_MODEL).not.toContain("v4");
    expect(IMAGE_EMBEDDING_MODEL).toBe("jina-embeddings-v5-omni-small");
  });

  it("matches the vector column width in the migration", () => {
    expect(migration).toContain(`extensions.vector(${IMAGE_EMBEDDING_DIM})`);
  });

  it("matches the model and dimension in the backfill script", () => {
    expect(backfill).toContain(`const MODEL = "${IMAGE_EMBEDDING_MODEL}"`);
    expect(backfill).toContain(`const DIM = ${IMAGE_EMBEDDING_DIM}`);
  });

  it("indexes product images with the retrieval.passage task", () => {
    // Asymmetric retrieval: product images are the corpus side.
    const index = readFileSync(join(REPO_ROOT, "lib/product-image-index.ts"), "utf8");
    expect(index).toContain('"retrieval.passage"');
  });

  it("embeds the buyer query image with the retrieval.query task", () => {
    const action = readFileSync(
      join(REPO_ROOT, "lib/buyer/image-search-action.ts"),
      "utf8",
    );
    expect(action).toContain('"retrieval.query"');
  });
});
