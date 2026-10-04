import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IMAGE_SEARCH_DEFAULT_THRESHOLD } from "../lib/ai/image-search-config";
import { encodeImageResultToken } from "../lib/ai/image-result-token";
import { findSimilarProducts } from "../lib/ai/search-products";
import { getProducts } from "../lib/storefront";

/**
 * Database-level behaviour of search-by-image.
 *
 * Runs against the local dev stack only — never the remote project — using the
 * same hard-coded URL and keys as tests/lifecycle.test.ts. Start it with
 * `pnpm dlx supabase start`; the suite skips with a hint when it is unreachable.
 * The migration must be applied first (`pnpm db:reset` or `pnpm db:push`).
 *
 * Embeddings are written directly with synthetic vectors rather than by running
 * CLIP. The RPC's ranking, threshold, visibility and cascade behaviour does not
 * depend on which numbers are in the column, and fixed vectors make the expected
 * similarities exact arithmetic instead of approximate recall. Real inference is
 * covered by tests/image-embeddings.test.ts.
 */

const URL = "http://127.0.0.1:54421";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CLIP_MODEL = "Xenova/clip-vit-base-patch32";
const OTHER_MODEL = "some/other-clip-model";

const service = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Anonymous buyers search through the anon grant on the SECURITY DEFINER RPC. */
const buyer = createClient(URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function probeLocal(): Promise<boolean> {
  try {
    const { error } = await service.from("product_images").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

const available = await probeLocal();

if (!available) {
  console.log(
    "[image-search-db] Local Supabase stack not reachable at " +
      URL +
      ". Start it with `pnpm dlx supabase start`.",
  );
}

// ---------------------------------------------------------------------------
// Synthetic 512-dimension embeddings with exact, known similarities.
// ---------------------------------------------------------------------------

const DIM = 512;

/**
 * A unit vector in the plane spanned by axis 0 and axis 1, whose cosine
 * similarity to QUERY (the zero-degree vector) is exactly cos(degrees). Expected
 * rankings and threshold effects are then arithmetic rather than guesses.
 */
function atAngle(degrees: number): number[] {
  const radians = (degrees * Math.PI) / 180;
  const vector = new Array<number>(DIM).fill(0);
  vector[0] = Math.cos(radians);
  vector[1] = Math.sin(radians);
  return vector;
}

const QUERY = atAngle(0); // similarity 1.0 with an identical image
const cos = (degrees: number) => Math.cos((degrees * Math.PI) / 180);

// IMAGE_SEARCH_DEFAULT_THRESHOLD is 0.55, so anything past ~56.6 degrees drops out.
const EXACT_DEGREES = 0; // 1.0000
const CLOSE_DEGREES = 20; // 0.9397
const MID_DEGREES = 45; // 0.7071
const FAR_DEGREES = 60; // 0.5000 — below the default threshold
const NONE_DEGREES = 90; // 0.0000

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ProductOptions = {
  status?: "draft" | "pending" | "approved" | "rejected";
  isHidden?: boolean;
  moq?: number;
};

// Module scope because the fixture helpers below are module-scope functions.
let companyId = "";
let categoryId = "";
let categorySlug = "";
let otherCategorySlug = "";

async function makeProduct(title: string, options: ProductOptions = {}): Promise<string> {
  const { data, error } = await service
    .from("products")
    .insert({
      supplier_id: companyId,
      category_id: categoryId,
      title,
      description:
        "A listing used to verify search by image, with enough words to satisfy the fifty character minimum description requirement.",
      seller_sku: `img-search-${title}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      hsn_code: "5208",
      unit: "mtr",
      price_per_unit: 100,
      moq: options.moq ?? 10,
      stock_qty: 100,
      lead_time_days: 5,
      gst_rate: 5,
      status: options.status ?? "approved",
      is_hidden: options.isHidden ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function addImage(productId: string, index: number): Promise<string> {
  const { data, error } = await service
    .from("product_images")
    .insert({ product_id: productId, path: `image-search-test/${productId}-${index}.jpg`, sort: index })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Write an embedding the way the indexer does — same columns, same
 * (product_image_id, model) uniqueness — but with a vector chosen by the test.
 */
async function embed(
  imageId: string,
  productId: string,
  vector: number[],
  model: string = CLIP_MODEL,
): Promise<void> {
  const { error } = await service.from("product_image_embeddings").upsert(
    { product_image_id: imageId, product_id: productId, embedding: vector, model },
    { onConflict: "product_image_id,model" },
  );
  if (error) throw error;
}

async function embeddingsFor(imageId: string): Promise<number> {
  const { count, error } = await service
    .from("product_image_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("product_image_id", imageId);
  if (error) throw error;
  return count ?? 0;
}

async function firstImageOf(productId: string): Promise<string> {
  const { data, error } = await service
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .order("sort")
    .limit(1)
    .single();
  if (error) throw error;
  return data.id as string;
}

describe.skipIf(!available)("match_product_images and image search", () => {
  const createdUsers: string[] = [];

  let exactId = "";
  let closeId = "";
  let midId = "";
  let farId = "";
  let noneId = "";
  let multiId = "";
  let multiFirstImageId = "";
  let multiSecondImageId = "";
  let hiddenId = "";
  let draftId = "";
  let otherModelId = "";
  let highMoqId = "";

  /** A product with one image embedded at `degrees`, at the default visibility. */
  async function productAtAngle(label: string, degrees: number): Promise<string> {
    const id = await makeProduct(`ImgSearch ${label}`);
    await embed(await addImage(id, 0), id, atAngle(degrees));
    return id;
  }

  beforeAll(async () => {
    const suffix = Date.now();

    const { data: userData, error: userError } = await service.auth.admin.createUser({
      email: `image-search-${suffix}@db.test`,
      password: "ImageSearchPass123!",
      email_confirm: true,
    });
    if (userError) throw userError;
    const ownerId = userData.user.id;
    createdUsers.push(ownerId);

    await service.from("profiles").delete().eq("id", ownerId);
    const { error: profileError } = await service.from("profiles").insert({
      id: ownerId,
      email: `image-search-${suffix}@db.test`,
      user_type: "supplier",
    });
    if (profileError) throw profileError;

    const { data: companyData, error: companyError } = await service
      .from("companies")
      .insert({
        owner_id: ownerId,
        business_name: "Image Search Test Co",
        contact_person: "Test",
        phone: "+91 9000000000",
        address: "Test Address, Test City",
        city: "Test",
        state: "Test",
        pincode: "000000",
        gstin: "24AAAAA0000A1Z5",
        pan: "AAAAA0000A",
        bank_account: "00000000000",
        bank_ifsc: "SBIN0000000",
        kyb_status: "verified",
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (companyError) throw companyError;
    companyId = companyData.id as string;

    categorySlug = `image-search-${suffix}`;
    const { data: categoryData, error: categoryError } = await service
      .from("categories")
      .insert({
        name: `Image Search ${suffix}`,
        slug: categorySlug,
        sort_order: 0,
        is_active: true,
        image_path: "seed/image-search-test.jpg",
      })
      .select("id")
      .single();
    if (categoryError) throw categoryError;
    categoryId = categoryData.id as string;

    otherCategorySlug = `image-search-other-${suffix}`;
    const { error: otherCategoryError } = await service.from("categories").insert({
      name: `Image Search Other ${suffix}`,
      slug: otherCategorySlug,
      sort_order: 1,
      is_active: true,
      image_path: "seed/image-search-test.jpg",
    });
    if (otherCategoryError) throw otherCategoryError;

    // The ranking ladder: an exact match down to an orthogonal one.
    exactId = await productAtAngle("Exact", EXACT_DEGREES);
    closeId = await productAtAngle("Close", CLOSE_DEGREES);
    midId = await productAtAngle("Mid", MID_DEGREES);
    farId = await productAtAngle("Far", FAR_DEGREES);
    noneId = await productAtAngle("None", NONE_DEGREES);

    // Two indexed images on one product, so de-duplication has work to do.
    multiId = await makeProduct("ImgSearch Multi");
    multiFirstImageId = await addImage(multiId, 0);
    multiSecondImageId = await addImage(multiId, 1);
    await embed(multiFirstImageId, multiId, QUERY); // exact
    await embed(multiSecondImageId, multiId, atAngle(MID_DEGREES)); // weaker duplicate

    // Visibility: approved but hidden.
    hiddenId = await makeProduct("ImgSearch Hidden", { isHidden: true });
    await embed(await addImage(hiddenId, 0), hiddenId, QUERY);

    // Visibility: never approved.
    draftId = await makeProduct("ImgSearch Draft", { status: "draft" });
    await embed(await addImage(draftId, 0), draftId, QUERY);

    // An embedding from another model must never be compared against ours.
    otherModelId = await makeProduct("ImgSearch OtherModel");
    await embed(await addImage(otherModelId, 0), otherModelId, QUERY, OTHER_MODEL);

    // Filter fixture: high MOQ, exact visual match, so only the MOQ filter can
    // remove it from an image result set.
    highMoqId = await makeProduct("ImgSearch HighMoq", { moq: 500 });
    await embed(await addImage(highMoqId, 0), highMoqId, QUERY);
  });

  afterAll(async () => {
    for (const uid of createdUsers) {
      await service.auth.admin.deleteUser(uid).catch(() => {});
    }
  });

  it("covers setup fixtures", () => {
    expect(available).toBe(true);
    expect(IMAGE_SEARCH_DEFAULT_THRESHOLD).toBe(0.55);
    expect(new Set([exactId, closeId, midId, farId, noneId, multiId]).size).toBe(6);
  });

  // -------------------------------------------------------------------------
  // Ranking
  // -------------------------------------------------------------------------

  it("ranks the closest image first", async () => {
    const { results, imageMatches } = await findSimilarProducts(buyer, QUERY);

    // Two image rows belong to `multiId`, so five images collapse to four
    // products, ordered best-score-first.
    expect(results.map((r) => r.productId)).toEqual([exactId, multiId, closeId, midId]);
    expect(results.map((r) => r.similarity)).toEqual([
      expect.closeTo(1, 4),
      expect.closeTo(1, 4),
      expect.closeTo(cos(CLOSE_DEGREES), 4),
      expect.closeTo(cos(MID_DEGREES), 4),
    ]);
    expect(imageMatches).toBe(5);
  });

  it("returns one row per image so the caller can de-duplicate", async () => {
    const { data, error } = await buyer.rpc("match_product_images", {
      p_query_embedding: QUERY as unknown as string,
      p_match_threshold: 0,
      p_match_count: 60,
      p_model: CLIP_MODEL,
    });

    expect(error).toBeNull();
    const rows = (data ?? []) as { product_id: string; product_image_id: string }[];
    // multiId appears twice — once per indexed image.
    expect(rows.filter((r) => r.product_id === multiId)).toHaveLength(2);
    expect(new Set(rows.map((r) => r.product_image_id)).size).toBe(rows.length);
  });

  it("keeps the best-scoring image when a product matches twice", async () => {
    const { results } = await findSimilarProducts(buyer, QUERY);
    const ids = results.map((r) => r.productId);

    expect(ids.filter((id) => id === multiId)).toHaveLength(1);
    // The weaker duplicate must not drag the score down.
    expect(results.find((r) => r.productId === multiId)!.similarity).toBeCloseTo(1, 4);
  });

  // -------------------------------------------------------------------------
  // Threshold
  // -------------------------------------------------------------------------

  it("applies the similarity threshold", async () => {
    // `far` scores 0.5, just under the 0.55 default.
    const strict = await findSimilarProducts(buyer, QUERY);
    expect(strict.results.map((r) => r.productId)).not.toContain(farId);
    expect(strict.results.map((r) => r.productId)).not.toContain(noneId);

    const lenient = await findSimilarProducts(buyer, QUERY, { threshold: 0.4 });
    const far = lenient.results.find((r) => r.productId === farId);
    expect(far).toBeDefined();
    expect(far!.similarity).toBeCloseTo(cos(FAR_DEGREES), 4);
    // Orthogonal still stays out even at 0.4.
    expect(lenient.results.map((r) => r.productId)).not.toContain(noneId);
  });

  it("returns nothing when no image clears the threshold", async () => {
    const { results, imageMatches } = await findSimilarProducts(buyer, atAngle(NONE_DEGREES), {
      threshold: 0.95,
    });

    expect(results).toEqual([]);
    expect(imageMatches).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  it("never surfaces a hidden or unapproved product", async () => {
    const { results } = await findSimilarProducts(buyer, QUERY, { threshold: 0 });
    const ids = results.map((r) => r.productId);

    expect(ids).not.toContain(hiddenId);
    expect(ids).not.toContain(draftId);
    // Both hold an exact match, so they would otherwise rank first — the
    // embeddings really are there, the RPC just refuses to return them.
    expect(await embeddingsFor(await firstImageOf(hiddenId))).toBe(1);
    expect(await embeddingsFor(await firstImageOf(draftId))).toBe(1);
  });

  it("ignores embeddings written by a different model", async () => {
    const { results } = await findSimilarProducts(buyer, QUERY, { threshold: 0 });
    expect(results.map((r) => r.productId)).not.toContain(otherModelId);

    // The row is not deleted, just not comparable — asking for that model
    // explicitly finds the product.
    const { data, error } = await buyer.rpc("match_product_images", {
      p_query_embedding: QUERY as unknown as string,
      p_match_threshold: 0,
      p_match_count: 60,
      p_model: OTHER_MODEL,
    });
    expect(error).toBeNull();
    expect((data ?? []).map((row: { product_id: string }) => row.product_id)).toEqual([
      otherModelId,
    ]);
  });

  // -------------------------------------------------------------------------
  // Limits
  // -------------------------------------------------------------------------

  it("clamps the requested match count", async () => {
    const one = await findSimilarProducts(buyer, QUERY, { matchCount: 0 });
    expect(one.results).toHaveLength(1);
    expect(one.results[0].similarity).toBeCloseTo(1, 4);

    // An absurd count is clamped to the function's ceiling rather than passed
    // through to a caller-controlled LIMIT.
    const many = await findSimilarProducts(buyer, QUERY, { matchCount: 100_000 });
    expect(many.imageMatches).toBeLessThanOrEqual(200);
    expect(many.imageMatches).toBeGreaterThan(1);
  });

  it("lets anonymous buyers search without exposing the vectors", async () => {
    const { error: rpcError } = await buyer.rpc("match_product_images", {
      p_query_embedding: QUERY as unknown as string,
      p_match_threshold: 0.9,
      p_match_count: 10,
      p_model: CLIP_MODEL,
    });
    expect(rpcError).toBeNull();

    const { data, error } = await buyer.from("product_image_embeddings").select("embedding");
    expect(data).toEqual([]);
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  it("deletes the embedding when its product image is deleted", async () => {
    const productId = await makeProduct("ImgSearch CascadeImage");
    const imageId = await addImage(productId, 0);
    await embed(imageId, productId, QUERY);
    expect(await embeddingsFor(imageId)).toBe(1);

    await service.from("product_images").delete().eq("id", imageId);

    expect(await embeddingsFor(imageId)).toBe(0);
  });

  it("deletes the embedding when its product is deleted", async () => {
    const productId = await makeProduct("ImgSearch CascadeProduct");
    const imageId = await addImage(productId, 0);
    await embed(imageId, productId, QUERY);
    expect(await embeddingsFor(imageId)).toBe(1);

    await service.from("products").delete().eq("id", productId);

    expect(await embeddingsFor(imageId)).toBe(0);
  });

  it("replaces an embedding on re-index instead of duplicating it", async () => {
    const productId = await makeProduct("ImgSearch Reindex");
    const imageId = await addImage(productId, 0);
    await embed(imageId, productId, QUERY);
    await embed(imageId, productId, atAngle(FAR_DEGREES));

    expect(await embeddingsFor(imageId)).toBe(1);

    const { results } = await findSimilarProducts(buyer, QUERY, { threshold: 0.4 });
    const match = results.find((r) => r.productId === productId);
    expect(match).toBeDefined();
    expect(match!.similarity).toBeCloseTo(cos(FAR_DEGREES), 4);
  });

  it("leaves no stale embedding when a saved product's images are replaced", async () => {
    // replace_product_images deletes and re-inserts, so a saved product gets
    // fresh image ids and the old embeddings go with them.
    const productId = await makeProduct("ImgSearch Replace");
    const originalImageId = await addImage(productId, 0);
    await embed(originalImageId, productId, QUERY);

    await service.from("product_images").delete().eq("id", originalImageId);
    const replacementImageId = await addImage(productId, 0);
    await embed(replacementImageId, productId, QUERY);

    expect(await embeddingsFor(originalImageId)).toBe(0);
    expect(await embeddingsFor(replacementImageId)).toBe(1);

    const { results } = await findSimilarProducts(buyer, QUERY);
    expect(results.filter((r) => r.productId === productId)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // The storefront listing: image search constrains, existing behaviour stands.
  // -------------------------------------------------------------------------

  it("orders the listing by visual similarity", async () => {
    const { results } = await findSimilarProducts(buyer, QUERY);
    const ids = results.map((r) => r.productId);
    expect(ids.length).toBeGreaterThan(1);

    const listing = await getProducts(buyer, { imageProductIds: ids, perPage: 20 });

    expect(listing.products.map((p) => p.id)).toEqual(ids);
    expect(listing.total).toBe(ids.length);
  });

  it("paginates image results without losing the ranking", async () => {
    const { results } = await findSimilarProducts(buyer, QUERY);
    const ids = results.map((r) => r.productId);

    const first = await getProducts(buyer, { imageProductIds: ids, perPage: 1, page: 1 });
    const second = await getProducts(buyer, { imageProductIds: ids, perPage: 1, page: 2 });

    expect(first.products.map((p) => p.id)).toEqual([ids[0]]);
    expect(second.products.map((p) => p.id)).toEqual([ids[1]]);
    expect(first.totalPages).toBe(ids.length);
  });

  it("still applies the MOQ filter to image candidates", async () => {
    const { results } = await findSimilarProducts(buyer, QUERY);
    const ids = results.map((r) => r.productId);
    // The fixture must actually be in the candidate set, or the test proves
    // nothing.
    expect(ids).toContain(highMoqId);

    const filtered = await getProducts(buyer, { imageProductIds: ids, minMoq: 400 });

    expect(filtered.products.map((p) => p.id)).toEqual([highMoqId]);
    expect(filtered.products.map((p) => p.id)).toEqual(ids.filter((id) => id === highMoqId));
  });

  it("still applies the category filter to image candidates", async () => {
    const { results } = await findSimilarProducts(buyer, QUERY);
    const ids = results.map((r) => r.productId);

    const matching = await getProducts(buyer, {
      imageProductIds: ids,
      categorySlug,
      perPage: 20,
    });
    expect(matching.total).toBe(ids.length);

    // Every candidate lives in `category`, so selecting the sibling category
    // can only empty the listing.
    const elsewhere = await getProducts(buyer, {
      imageProductIds: ids,
      categorySlug: otherCategorySlug,
      perPage: 20,
    });
    expect(elsewhere.products).toEqual([]);
    expect(elsewhere.total).toBe(0);
  });

  it("never widens the listing beyond the approved, visible catalog", async () => {
    // A hand-edited token can name any product id. getProducts has to keep
    // rejecting hidden and unapproved ones — and a bare id from another table.
    const listing = await getProducts(buyer, {
      imageProductIds: [hiddenId, draftId, categoryId],
      perPage: 10,
    });

    expect(listing.products).toEqual([]);
    expect(listing.total).toBe(0);
  });

  it("keeps the existing text search working unchanged", async () => {
    const listing = await getProducts(buyer, { query: "ImgSearch", perPage: 50 });

    expect(listing.products.length).toBeGreaterThan(0);
    expect(listing.products.every((p) => /ImgSearch/i.test(p.title as string))).toBe(true);
    // Text search sees the whole approved catalog, not an image result set.
    expect(listing.products.map((p) => p.id)).toContain(exactId);
    expect(listing.products.map((p) => p.id)).not.toContain(draftId);
    expect(listing.products.map((p) => p.id)).not.toContain(hiddenId);
  });

  it("carries a full result set through the URL token within a sane length", async () => {
    const { results } = await findSimilarProducts(buyer, QUERY);
    const ids = results.map((r) => r.productId);

    // 16 raw bytes per id keeps a 60-product result well inside a URL.
    const token = encodeImageResultToken(ids);
    expect(token.length).toBeLessThan(2048);

    const listing = await getProducts(buyer, { imageProductIds: ids, perPage: 20 });
    expect(listing.products.map((p) => p.id)).toEqual(ids);
  });
});