/**
 * Backfill CLIP embeddings for catalog product images.
 *
 *   pnpm embeddings:backfill
 *
 * Explicitly invoked only. Never runs during `next build`, `next dev` startup or
 * a migration, because it downloads ~89 MB of model weights and embeds the
 * whole catalog.
 *
 * Resumable: images that already have a row for the current model are skipped,
 * so re-running after a failure only does the remaining work. Individual image
 * failures are logged and the run continues.
 *
 * Run with Node's native TypeScript support, which requires relative imports to
 * carry explicit `.ts` extensions (hence the unusual-looking specifiers).
 */
import { createAdminClient } from "../lib/supabase/admin.ts";
import { IMAGE_BACKFILL_BATCH_SIZE } from "../lib/ai/image-search-config.ts";
import { indexProductImage } from "../lib/ai/index-product-image.ts";
import { IMAGE_EMBEDDING_MODEL } from "../lib/ai/image-embeddings.ts";

type ProductImageRow = {
  id: string;
  product_id: string;
  path: string;
};

const admin = createAdminClient();

/**
 * Keyset pagination on product_images.id, so a long run never accumulates an
 * offset scan and never holds more than one batch of images in memory.
 */
async function* iterateImagesMissingEmbeddings(batchSize: number) {
  let cursor: string | null = null;

  for (;;) {
    let query = admin
      .from("product_images")
      .select("id, product_id, path")
      .order("id", { ascending: true })
      .limit(batchSize);

    if (cursor) query = query.gt("id", cursor);

    const { data, error } = await query;
    if (error) throw new Error(`could not read product images: ${error.message}`);

    const batch = (data ?? []) as ProductImageRow[];
    if (batch.length === 0) return;

    yield batch;
    cursor = batch[batch.length - 1].id;

    if (batch.length < batchSize) return;
  }
}

async function existingImageIds(batch: ProductImageRow[]): Promise<Set<string>> {
  const { data, error } = await admin
    .from("product_image_embeddings")
    .select("product_image_id")
    .eq("model", IMAGE_EMBEDDING_MODEL)
    .in(
      "product_image_id",
      batch.map((image) => image.id),
    );

  if (error) throw new Error(`could not read existing embeddings: ${error.message}`);
  return new Set((data ?? []).map((row) => row.product_image_id as string));
}

async function main() {
  const startedAt = Date.now();

  const { count } = await admin
    .from("product_images")
    .select("id", { count: "exact", head: true });
  const { count: indexed } = await admin
    .from("product_image_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("model", IMAGE_EMBEDDING_MODEL);

  console.log(`[backfill] model       ${IMAGE_EMBEDDING_MODEL}`);
  console.log(`[backfill] images      ${count ?? 0}`);
  console.log(`[backfill] already set ${indexed ?? 0}`);
  console.log(`[backfill] batch size  ${IMAGE_BACKFILL_BATCH_SIZE}`);

  let seen = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for await (const batch of iterateImagesMissingEmbeddings(IMAGE_BACKFILL_BATCH_SIZE)) {
    seen += batch.length;

    let alreadyIndexed: Set<string>;
    try {
      alreadyIndexed = await existingImageIds(batch);
    } catch (err) {
      console.error(`[backfill] ${(err as Error).message}`);
      break;
    }

    for (const image of batch) {
      if (alreadyIndexed.has(image.id)) {
        skipped += 1;
        continue;
      }

      const imageStartedAt = Date.now();
      try {
        await indexProductImage(admin, image);
        created += 1;
        console.log(`[backfill] + ${image.id} (${Date.now() - imageStartedAt}ms)`);
      } catch (err) {
        failed += 1;
        console.error(`[backfill] ! ${image.id}: ${(err as Error).message}`);
      }
    }

    console.log(
      `[backfill] ${seen} seen / ${created} created / ${skipped} skipped / ${failed} failed`,
    );
  }

  console.log(
    `[backfill] done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s — ` +
      `${created} created, ${skipped} skipped, ${failed} failed`,
  );

  if (failed > 0) {
    // Non-zero exit so CI or a deploy hook can notice a partial index.
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (err) {
  console.error("[backfill] aborted:", (err as Error).message);
  process.exitCode = 1;
}