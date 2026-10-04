-- =============================================================================
-- Search by image: CLIP image embeddings + pgvector similarity search.
--
-- Buyers upload a reference photo; the app embeds it locally with CLIP via
-- Transformers.js (see lib/ai/image-embeddings.ts) and ranks storefront
-- products by cosine similarity. The uploaded photo is never persisted — only
-- the vector derived from it, and only for catalog images.
--
-- Vectors produced by different models are not comparable, so `model` is
-- stored on every row and match_product_images only ever compares rows that
-- share the caller's model. Changing IMAGE_EMBEDDING_MODEL in
-- lib/ai/image-embeddings.ts therefore requires a full re-index
-- (`pnpm embeddings:backfill`), not just new rows.
-- =============================================================================

-- pgvector lives in `extensions` (Supabase's convention, and the schema listed
-- in supabase/config.toml extra_search_path). Created defensively because no
-- earlier migration in this repo references that schema, so its presence is
-- not otherwise guaranteed by the migration history. Both statements are
-- no-ops when the extension is already installed -- 20260930150000
-- (_drop_image_search.sql) deliberately left the extension behind.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- Product image embeddings
-- -----------------------------------------------------------------------------

create table public.product_image_embeddings (
  id uuid primary key default gen_random_uuid(),
  product_image_id uuid not null
    references public.product_images (id) on delete cascade,
  -- Denormalised from product_images so ranking and the eligibility filter do
  -- not need a join through product_images.
  product_id uuid not null
    references public.products (id) on delete cascade,
  -- Must match IMAGE_EMBEDDING_DIM in lib/ai/image-embeddings.ts. 512 floats
  -- is CLIP ViT-B/32's projected image-embedding width.
  embedding extensions.vector(512) not null,
  model text not null default 'Xenova/clip-vit-base-patch32',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Re-indexing the same image with the same model must replace, not duplicate.
  constraint product_image_embeddings_image_model_unique unique (product_image_id, model)
);

create index product_image_embeddings_product_idx
  on public.product_image_embeddings (product_id);

create index product_image_embeddings_product_image_idx
  on public.product_image_embeddings (product_image_id);

-- Approximate nearest-neighbour index for when the catalog outgrows the exact
-- scan below. Match_product_images computes exact cosine distances, which is
-- both correct and fast at current catalog size, so this index is a safety net
-- rather than something the function depends on today.
create index product_image_embeddings_hnsw
  on public.product_image_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

comment on table public.product_image_embeddings is
  'Cosine embeddings of catalog product images, one row per (product_images row, model). Model id must match IMAGE_EMBEDDING_MODEL in lib/ai/image-embeddings.ts.';

alter table public.product_image_embeddings enable row level security;

-- RLS with no policies, deliberately: this table holds derived catalog data
-- that only server-side code (the indexer, the backfill script and the
-- SECURITY DEFINER search function) may touch. Suppliers never write their own
-- embeddings — indexing happens in the server action after
-- replace_product_images commits, via the service-role client. Reads for the
-- storefront go through match_product_images, which is SECURITY DEFINER and
-- does its own eligibility filtering.

-- New tables are not auto-exposed to the Data API; revoke explicitly so a
-- stray grant from an earlier iteration cannot leak vectors (see
-- 20260906091225_create_profiles.sql). service_role bypasses RLS and is used
-- by lib/supabase/admin.ts.
revoke all on public.product_image_embeddings from anon;
revoke all on public.product_image_embeddings from authenticated;

-- -----------------------------------------------------------------------------
-- Similarity search
--
-- PostgREST cannot express the pgvector distance operator, so similarity
-- search has to go through an RPC.
--
-- SECURITY DEFINER is required (and is the point): the table grants nothing to
-- anon/authenticated, and this function is the only reader. It is written as
-- SECURITY INVOKER would leave it unable to see a single row. Because the
-- privilege boundary is the function body, the eligibility filter below is the
-- single place that decides what a buyer may see, and it mirrors the storefront
-- condition used by public.products/products_select_approved (refined in
-- 20260924120000_editable_and_hideable_products.sql): approved AND not hidden.
--
-- One row per matching product *image*, not per product: deduping to one row
-- per product would require sorting every match before the LIMIT, which
-- defeats the HNSW index. Collapsing to products happens in the caller, which
-- keeps the top-scoring image per product (see lib/ai/search-products.ts).
--
-- The distance operator is schema-qualified via OPERATOR(extensions.<=>) so
-- this can keep search_path = '', matching every other function in this schema.
-- -----------------------------------------------------------------------------

create or replace function public.match_product_images(
  p_query_embedding extensions.vector(512),
  p_match_threshold double precision default 0.55,
  p_match_count int default 60,
  p_model text default 'Xenova/clip-vit-base-patch32'
)
returns table (
  product_image_id uuid,
  product_id uuid,
  similarity double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.product_image_id,
    e.product_id,
    (1 - (e.embedding OPERATOR(extensions.<=>) p_query_embedding))::double precision as similarity
  from public.product_image_embeddings e
  join public.products p on p.id = e.product_id
  where e.model = p_model
    -- Mirrors products_select_approved: only approved, non-hidden products are
    -- storefront-visible, so a draft, rejected or hidden listing can never
    -- surface through image search.
    and p.status = 'approved'
    and p.is_hidden = false
    and (1 - (e.embedding OPERATOR(extensions.<=>) p_query_embedding)) >= p_match_threshold
  order by e.embedding OPERATOR(extensions.<=>) p_query_embedding asc
  limit greatest(least(coalesce(p_match_count, 60), 200), 1)
$$;

comment on function public.match_product_images(extensions.vector, double precision, int, text) is
  'Ranks approved, non-hidden product images by cosine similarity to a query embedding. Returns one row per matching image so the caller can keep the best-scoring image per product. Similarity is a distance-derived score, not a confidence percentage.';

revoke all on function public.match_product_images(extensions.vector, double precision, int, text) from public;

-- Anonymous visitors must be able to search: the storefront product grid is
-- public, and this function is the only reader of the embeddings table. It
-- reveals nothing the caller could not already read from public.products.
grant execute on function public.match_product_images(extensions.vector, double precision, int, text) to anon, authenticated;