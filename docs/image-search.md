# Search by image

A buyer uploads a photo and gets the catalog products that look most like it.

The feature is an additional mode on the existing `/products` listing. Text
search, filters, sorting and pagination are untouched — image search only
narrows the candidate set.

- **No external AI service.** The model runs in-process on the Node.js runtime.
  Nothing about a buyer's photo leaves the server.
- **No stored buyer images.** An uploaded photo is decoded in memory, reduced to
  a vector, and discarded. Only catalog images are ever embedded.
- **No paywalled dependencies.** `@huggingface/transformers`, `Xenova/clip-vit-base-patch32`
  and pgvector, all of which run on hardware you already have.

## How it works

```
catalog image ──▶ CLIP (Transformers.js) ──▶ 512-d unit vector ──▶ pgvector
                                                                        │
buyer photo ──▶ CLIP (Transformers.js) ──▶ 512-d query vector ─────────┤ cosine <#> ranked
                                                                        ▼
                                              match_product_images() ─▶ product ids
                                                                        ▼
                                              getProducts(imageProductIds) ─▶ /products?img=<token>
```

### Embeddings

`lib/ai/image-embeddings.ts` holds the model. It is a lazy, per-process
singleton: the Transformers.js import happens inside `getExtractor()`, so nothing
executes at module load and `next build` never touches the model.

Vectors are **normalised to unit length** before storage. This is not cosmetic —
CLIP's raw projected output has a measured L2 norm around 11, and cosine
similarity is only meaningful once the vectors point in a consistent direction.
Unit length also means pgvector's cosine distance can be read as plain Euclidean
distance.

`getImageEmbedding` asserts the shape it received: exactly
`IMAGE_EMBEDDING_DIM` (512) finite numbers, or it throws rather than writing a
malformed vector.

### Storage

Migration `20261002120000_add_product_image_embeddings.sql` creates
`product_image_embeddings`:

| Column | Purpose |
| --- | --- |
| `product_image_id` | The catalog image this describes. Cascades on delete. |
| `product_id` | Denormalised from `product_images` so ranking needs no join. |
| `embedding` | `extensions.vector(512)`. |
| `model` | Model id. Unique per `(product_image_id, model)`. |

`model` is stored per row because vectors from different models are not
comparable. `match_product_images` takes a `p_model` argument and filters on it,
so a model swap can never silently compare old vectors against new queries.
Changing `IMAGE_EMBEDDING_MODEL` requires a full re-index.

The table has RLS enabled with **no policies**, and all grants to `anon` and
`authenticated` are revoked. Reads happen only through the `SECURITY DEFINER`
search function; writes only through the service-role client. New tables are not
auto-exposed to the Data API, so the revokes also guard against a stray grant
from an earlier iteration.

### Visibility

`match_product_images` is the only reader, so its `WHERE` clause is the whole
privilege boundary. It mirrors the storefront condition from
`products_select_approved`: `status = 'approved' and is_hidden = false`. A
draft, rejected or hidden listing cannot surface through image search.

This is enforced twice on purpose. The RPC filters, and `getProducts` filters
again — so a hand-edited `img=` token can at worst list products `/products`
would have listed anyway.

The function returns **one row per matching image**, not per product. Collapsing
to one row per product in SQL would require sorting every match before the
`LIMIT`, which defeats the index. `dedupeImageMatches` in
`lib/ai/image-search-matches.ts` collapses to products in JS, keeping the
highest-scoring image per product.

`match_count` is clamped to `[1, 200]` in SQL, so a caller cannot ask for an
unbounded result set.

### Result transport

Image search returns product ids, not a new table and not a session. The ids are
encoded into a `img=` URL parameter — 16 raw bytes per UUID, base64url-encoded —
which keeps a 60-product result near 1.3 KB instead of ~4 KB of percent-escaped
UUIDs.

This is stateless on purpose: no table to expire, no cleanup job. Because every
consumer still goes through `getProducts`, which re-applies the visibility and
filter conditions, a tampered token reveals nothing new.

## Indexing

`lib/ai/index-product-image.ts` runs after a product save, from
`lib/supplier/product-actions.ts`. It is placed **after the last database
mutation** in `createProduct` / `updateProduct`, so a rolled-back product is
never embedded.

Two properties worth stating explicitly:

- **Product saves never fail because of embedding.** Failures are logged and
  swallowed; the image simply stays un-indexed and the backfill picks it up.
- **It is awaited, not fire-and-forget, and bounded** by
  `IMAGE_INDEXING_TIMEOUT_MS` (15 s). A detached promise is not guaranteed to run
  on a serverless runtime after the response is flushed, and a silently
  un-indexed image is a quietly degraded search. The bound is what keeps the
  admin UI responsive: warm inference is ~100 ms per image, while a cold start
  would otherwise block the save on a model download.

`replace_product_images` deletes and re-inserts `product_images` rows, so a
re-saved product gets fresh image UUIDs and the old embeddings cascade away.
Re-indexing the same image with the same model upserts on
`(product_image_id, model)` rather than accumulating duplicates.

## Backfill

Catalog images that predate the feature need embeddings. The backfill is a
separate, explicitly invoked script:

```bash
pnpm embeddings:backfill
```

It keyset-paginates in batches of `IMAGE_BACKFILL_BATCH_SIZE` (50) and is
resumable — re-running continues from where it stopped rather than starting
over. A single unreadable or undecodable image is logged and skipped, not fatal;
the script exits non-zero if anything failed so CI or an operator can notice.

**This script is never part of `build`, `dev`, or a migration.** Nothing in this
feature runs embedding generation during `next build`.

## Tuning the threshold

`IMAGE_SEARCH_DEFAULT_THRESHOLD` (`lib/ai/image-search-config.ts`) is **0.55**,
and it is a cosine distance threshold, **not a confidence percentage**. A result
at 0.70 does not mean "70% sure this is the same product."

CLIP's score distribution depends on the model and on how homogeneous your
catalog is, so this number has to be measured against real queries over real
catalog images.

Measured against the live 25-product / 57-image catalog, querying with each
product's own photograph:

| | |
| --- | --- |
| Own product ranked #1 | 16 / 17 |
| Own product's score | 1.0000 (it is the same file) |
| Runner-up score | 0.73 – 0.85 |
| Best score for an image containing no catalog product | **0.8780** |
| Photos returned for an image with no product in it | **23 of 25** |

The one miss is not a ranking failure: two products in the seed catalog share a
byte-identical image (`seed/pkg-3ply-1812-0.jpg` and `seed/agr-drip-1a-2.jpg`,
distance `0.000000`), so both score 1.0000 and the tie is unresolvable by
appearance alone.

The finding that matters: **at 0.55 the threshold rejects nothing.** An image
with no product in it still returns 23 of 25 products. The gap between a real
match (1.0000) and a real product's runner-up (≤0.8532) is wide, but unrelated
imagery reaches 0.8780 — inside that gap.

0.55 is left in place because there is no threshold that separates the two
populations here: a blank studio background scores higher than several genuine
matches' runner-ups. Raising it to 0.88 would reject the noise cases but also
most genuine near-duplicates; the ranking itself is sound, the score is simply
not a calibrated confidence.

If results ever feel too broad, the lever that helps is **catalog quality**, not
the threshold: distinct photography per product, and fewer products sharing a
background. Two products with identical images cannot be told apart at any
threshold.

To re-tune once you have real buyer photos:

1. Pick 10–20 query photos representative of how buyers actually search.
2. Run each through `/api/search/image` and record the returned similarity
   values.
3. Record the best score each query produces, and separately the best score for
   images you know contain no catalog product. The threshold has to sit between
   those two populations to be doing anything at all.

Raise it to tighten results, lower it to surface more and noisier candidates.
Leave `p_match_count` and `IMAGE_SEARCH_MAX_PRODUCTS` alone unless you also
revisit the token length above.

## Deployment notes

CLIP inference runs in a standalone service (`services/image-search/`, see its
README). The browser never talks to it — the flow is:

```
browser ─▶ Vercel POST /api/search/image ─▶ inference service POST /embed
  ─▶ 512-d unit vector ─▶ Supabase match_product_images() ─▶ product ids
  ─▶ existing /products?img=<token> result flow
```

Vercel keeps request validation, rate limiting, the pgvector search, and the
`ImageSearchResponse` shape; the service owns model loading (once per process,
weights cached, never downloaded per request), Bearer-token auth
(`IMAGE_SEARCH_SERVICE_TOKEN`), and `/health`. Vercel needs
`IMAGE_SEARCH_SERVICE_URL` + `IMAGE_SEARCH_SERVICE_TOKEN`; the service needs
`IMAGE_SEARCH_SERVICE_TOKEN`. The Next.js bundle contains no
Transformers.js/ONNX/weights (verified via the route's `.nft.json` trace).

### Loading the weights from disk

Transformers.js does **not** honour `HF_HOME` or `HF_HUB_OFFLINE` — those are
`python-transformers` conventions, and setting them has no effect. It reads
`env.cacheDir` (default `.cache` beside its own install) and `env.localModelPath`.
To load from disk without any network access:

```ts
env.cacheDir = null;
env.useFSCache = false;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "<repo>/models"; // library appends <org>/<model>
```

Setting `allowRemoteModels = false` **and** `allowLocalModels = false` fails
immediately with `Invalid configuration detected: both local and remote models
are disabled` — useful, but only reachable when the local path is already
misconfigured.

### Changing the model

The `model` column and the RPC's `p_model` argument exist so a different CLIP
variant can be introduced without mixing vector spaces: rows from another model
are simply not compared. Backfill the new model, verify ranking, then retire
the old rows. `IMAGE_EMBEDDING_DIM` and the migration's `vector(512)` must move
together.

`IMAGE_INDEXING_TIMEOUT_MS` (15 s) is bounded because a product save must not
hang on a model load. It is comfortably above the ~0.9 s local figure and
below the download figure, which is the intent: indexing degrades to
"image not indexed" rather than blocking the supplier's save.

## Limitations

CLIP matches **visual appearance, not product identity**. It is doing
`looks like that photo`, not `is that SKU`. Expect it to rank a different-brand
product with near-identical packaging as a strong match. The UI is worded
accordingly — "Products similar to your photo" — and never claims an exact or
identified match.

Known limits, stated rather than hidden:

- Colour and layout dominate. Two different products photographed on the same
  white background score closely.
- A photo of packaging matches the packaging, not the contents.
- Dense colour histograms (the noise-image case above) compress toward 1.0 and
  can match almost anything.
- The 512-d ViT-B/32 model is a speed/accuracy trade-off. A larger CLIP variant
  ranks better and costs proportionally more to load.

## Files

| Path | Role |
| --- | --- |
| `lib/ai/image-embeddings.ts` | Local CLIP runtime for the inference service and offline CLI backfill. Never imported by app routes. |
| `lib/ai/image-embedding-model.ts` | Model id/dim constants. Client-safe. |
| `lib/ai/image-inference-client.ts` | Vercel → service client (auth, timeout, validation). Server-only. |
| `lib/ai/image-model-source.ts` | Resolves `models/` and points Transformers.js at it. Server-only. |
| `lib/ai/image-search-config.ts` | Tunables and shared types. Client-safe. |
| `lib/ai/search-products.ts` | RPC wrapper. Server-only. |
| `lib/ai/image-search-matches.ts` | Image matches → products. Pure. |
| `lib/ai/image-result-token.ts` | `img=` token encode/decode. Pure. |
| `lib/ai/image-search-rate-limit.ts` | Fixed-window limiter. |
| `lib/ai/index-product-image.ts` | Post-save indexing. Server-only. |
| `lib/supabase/admin.ts` | Service-role client. Server-only. |
| `app/api/search/image/route.ts` | Upload endpoint. |
| `components/storefront/image-search-button.tsx` | Camera button and preview. |
| `scripts/backfill-product-image-embeddings.ts` | `pnpm embeddings:backfill`. Uses the service when configured, local CLIP otherwise. |
| `services/image-search/` | Standalone inference service (Docker, `/health`, `/embed`). |

## Tests

```bash
pnpm test                                        # everything, offline
IMAGE_SEARCH_MODEL_TESTS=1 pnpm vitest run tests/image-embeddings.test.ts
```

`tests/image-search-db.test.ts` needs the local stack:

```bash
pnpm dlx supabase start
pnpm vitest run tests/image-search-db.test.ts
```

It skips with a hint when the stack is unreachable, and it uses the same
hard-coded local URL and keys as `tests/lifecycle.test.ts` — never the remote
project.

Note that `tests/image-embeddings.test.ts` is opt-in because a run without
`models/` populated has to download ~85 MB first. After
`pnpm embeddings:fetch-model` the whole file runs in **~2 s**, because the
gated tests then load the weights from disk like any other code path.