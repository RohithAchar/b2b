#!/usr/bin/env node
/**
 * Backfill product image embeddings, and purge vectors for the current model.
 *
 * Live indexing from the product editor only covers images added after this
 * feature shipped, and it is best-effort by design. This script closes both gaps
 * and is the required step after changing IMAGE_EMBEDDING_MODEL in
 * lib/embeddings.ts: vectors from different models are not comparable, so stale
 * rows must be deleted rather than left to mix spaces.
 *
 * Runs on the service-role key, bypassing RLS, so it can see draft and hidden
 * products too. Requires .env.local to be loaded into the environment first.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-image-embeddings.mjs [--limit N]
 *
 * Flags:
 *   --limit N    Stop after N products (use to trial the run and check spend).
 *   --dry-run    Report what would be embedded; write nothing.
 *
 * Resumable: a product is skipped when all of its images already have a row for
 * the current model, so re-running only picks up what is missing.
 */

import { createClient } from "@supabase/supabase-js";

const ENDPOINT = "https://api.jina.ai/v1/embeddings";

// Kept in sync with lib/embeddings.ts by tests/image-search.test.ts, which fails
// if these two drift apart.
const MODEL = "jina-embeddings-v5-omni-small";
const DIM = 1024;

const BUCKET = "product_images";
const BATCH_SIZE = 8;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 4;
const BACKOFF_CAP_MS = 30_000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Infinity;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Run with --env-file=.env.local`);
    process.exit(1);
  }
  return value;
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const jinaKey = requireEnv("JINA_API_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function backoffMs(attempt) {
  const ceiling = Math.min(1000 * 2 ** attempt, BACKOFF_CAP_MS);
  return Math.ceil(ceiling / 2 + Math.random() * (ceiling / 2));
}

async function embedUrls(urls) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(backoffMs(attempt - 1));

    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jinaKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          input: urls.map((image) => ({ image })),
          dimensions: DIM,
          normalized: true,
          embedding_type: "float",
          task: "retrieval.passage",
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      console.warn(`  request error: ${err.message} (attempt ${attempt + 1})`);
      continue;
    }

    if (response.ok) {
      const json = await response.json();
      const data = [...(json.data ?? [])].sort((a, b) => a.index - b.index);
      if (data.length !== urls.length) {
        throw new Error(`expected ${urls.length} vectors, got ${data.length}`);
      }
      for (const item of data) {
        if (!Array.isArray(item.embedding) || item.embedding.length !== DIM) {
          throw new Error(`unexpected embedding dimension; expected ${DIM}`);
        }
      }
      return { vectors: data.map((d) => d.embedding), tokens: json.usage?.total_tokens ?? 0 };
    }

    const body = (await response.text()).slice(0, 300);
    // 4xx other than 429 will not succeed on retry.
    if (response.status < 500 && response.status !== 429) {
      throw new Error(`Embedding API ${response.status}: ${body || response.statusText}`);
    }
    console.warn(`  Embedding API ${response.status}; retrying (attempt ${attempt + 1})`);
  }
  throw new Error("Embedding API failed after retries");
}

function publicImageUrl(path) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  // Remove vectors for the current model so a model change cannot leave two
  // incomparable vector sets in the same column.
  const { count: staleCount } = await supabase
    .from("product_image_embeddings")
    .select("product_image_id", { count: "exact", head: true })
    .eq("model", MODEL);

  if ((staleCount ?? 0) > 0) {
    if (dryRun) {
      console.log(`[dry-run] would delete ${staleCount} existing ${MODEL} vector(s)`);
    } else {
      const { error } = await supabase
        .from("product_image_embeddings")
        .delete()
        .eq("model", MODEL);
      if (error) throw new Error(`purge failed: ${error.code} ${error.message}`);
      console.log(`Deleted ${staleCount} stale ${MODEL} vector(s).`);
    }
  }

  const { data: images, error: imageError } = await supabase
    .from("product_images")
    .select("id, product_id, path")
    .order("product_id")
    .limit(limit * 8);

  if (imageError) throw new Error(`product_images read failed: ${imageError.code} ${imageError.message}`);

  // Group by product so one product's images are indexed together.
  const byProduct = new Map();
  for (const row of images ?? []) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row);
    byProduct.set(row.product_id, list);
  }

  console.log(
    `${images?.length ?? 0} image(s) across ${byProduct.size} product(s); model ${MODEL}.`,
  );
  if ((images?.length ?? 0) === 0) {
    console.log("Nothing to do.");
    return;
  }

  const seenProducts = new Set();
  let indexed = 0;
  let totalTokens = 0;
  let failed = 0;

  for (const [productId, rows] of byProduct) {
    if (seenProducts.size >= limit) break;
    seenProducts.add(productId);

    const { data: existing } = await supabase
      .from("product_image_embeddings")
      .select("product_image_id")
      .eq("product_id", productId)
      .eq("model", MODEL);

    const indexedIds = new Set((existing ?? []).map((r) => r.product_image_id));
    const pending = rows.filter((r) => !indexedIds.has(r.id));

    if (pending.length === 0) continue;

    if (dryRun) {
      console.log(`[dry-run] would embed ${pending.length} image(s) for product ${productId}`);
      indexed += pending.length;
      continue;
    }

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const urls = batch.map((r) => publicImageUrl(r.path));

      try {
        const { vectors, tokens } = await embedUrls(urls);
        totalTokens += tokens;

        const { error } = await supabase.from("product_image_embeddings").upsert(
          batch.map((row, idx) => ({
            product_image_id: row.id,
            product_id: productId,
            model: MODEL,
            embedding: vectors[idx],
          })),
          { onConflict: "product_image_id" },
        );
        if (error) throw new Error(`upsert failed: ${error.code} ${error.message}`);

        indexed += batch.length;
        process.stdout.write(`\r  indexed ${indexed} image(s), ${totalTokens} tokens`);
      } catch (err) {
        failed += batch.length;
        console.error(`\n  product ${productId}: ${err.message}`);
      }
    }
  }

  console.log("");
  console.log(
    `Done. indexed=${indexed} failed=${failed} tokens=${totalTokens}${
      dryRun ? " (dry run, nothing written)" : ""
    }`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
