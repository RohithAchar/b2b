-- =============================================================================
-- HISTORICAL MIGRATION — reconstructed to match remote database state.
--
-- This migration was applied to the linked remote project on 2026-09-29, but its
-- file was never committed: the search-by-image work it belonged to was reverted
-- in 9b0ddad, which deleted the committed migration and added
-- 20260930150000_drop_image_search.sql to undo it.
--
-- The remote still carries the version in supabase_migrations, so the file is
-- required for `supabase db push` to see local and remote histories as equal.
-- It is reconstructed verbatim from the `statements` array recorded in
-- supabase_migrations.schema_migrations, and it will never execute: the remote
-- has already applied this exact version.
--
-- Its effects have since been superseded:
--   * product_image_embeddings was dropped by 20260930150000_drop_image_search.sql
--   * match_product_images survives as an orphan and is replaced by
--     20261002120000_add_product_image_embeddings.sql, which recreates the table
--     and replaces the function body.
--
-- Do not edit. See 20261002120000_add_product_image_embeddings.sql for the
-- version of this feature that is actually live.
-- =============================================================================

-- Product image embeddings: CLIP image vectors for search-by-image.
--
-- One row per product image, per model. Embeddings are produced server-side
-- (lib/ai/index-product-image.ts) and the similarity search runs through the
-- match_product_images RPC below.
--
-- Nothing here is client-writable: RLS is enabled with no policies and all
-- grants to anon/authenticated are revoked, so only the service role (server
-- only, lib/supabase/admin.ts) can read or write embeddings. The storefront
-- reaches similarity results exclusively through the RPC.

-- =============================================================================
-- 1. pgvector
-- =============================================================================
-- Hosted Supabase already ships pgvector in `extensions`; this is a no-op there
-- and creates it for a fresh local stack.
create extension if not exists vector with schema extensions;

-- =============================================================================
-- 2. product_image_embeddings
-- =============================================================================
create table public.product_image_embeddings (
  id uuid primary key default gen_random_uuid(),
  product_image_id uuid not null references public.product_images (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  embedding extensions.vector(512) not null,
  model text not null default 'Xenova/clip-vit-base-patch32',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_image_embeddings_image_model_unique unique (product_image_id, model)
);

create index product_image_embeddings_product_idx on public.product_image_embeddings (product_id);

create index product_image_embeddings_image_idx on public.product_image_embeddings (product_image_id);

-- Approximate nearest-neighbour index for cosine distance. Same operator class
-- as the `<=>` operator used by match_product_images, otherwise the planner
-- cannot use it and falls back to a sequential scan.
create index product_image_embeddings_embedding_hnsw_idx
  on public.product_image_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

drop trigger if exists set_product_image_embeddings_updated_at on public.product_image_embeddings;

create trigger set_product_image_embeddings_updated_at
  before update on public.product_image_embeddings
  for each row execute function internal.set_updated_at();

-- =============================================================================
-- 3. Lockdown
-- =============================================================================
alter table public.product_image_embeddings enable row level security;

-- No policies on purpose: with RLS enabled and no policy, no client role can
-- touch a row. The public schema grants ALL on new objects to anon /
-- authenticated, so revoke before relying on that.
revoke all on public.product_image_embeddings from anon, authenticated;

-- =============================================================================
-- 4. match_product_images: cosine similarity search
-- =============================================================================
-- Mirrors the storefront visibility rule used by lib/storefront.ts getProducts:
-- approved AND not hidden. Returns one row per matching product image; the
-- caller collapses those to one row per product (lib/ai/image-search.ts).
create or replace function public.match_product_images(
  p_query_embedding extensions.vector(512),
  p_match_threshold float default 0.55,
  p_match_count int default 60,
  p_model text default 'Xenova/clip-vit-base-patch32'
)
returns table (
  product_image_id uuid,
  product_id uuid,
  similarity float
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold float;
  v_limit int;
begin
  -- Guard the two knobs a caller controls. A negative cosine distance is
  -- meaningless as a floor, and an unbounded limit would let a client pull the
  -- whole catalogue through the RPC.
  v_threshold := greatest(coalesce(p_match_threshold, 0.55), -1.0);
  v_limit := least(greatest(coalesce(p_match_count, 60), 1), 200);

  return query
  select
    e.product_image_id,
    e.product_id,
    (1 - (e.embedding OPERATOR(extensions.<=>) p_query_embedding))::float as similarity
  from public.product_image_embeddings e
  join public.products p
    on p.id = e.product_id
   and p.status = 'approved'
   and p.is_hidden = false
  where e.model = p_model
    and 1 - (e.embedding OPERATOR(extensions.<=>) p_query_embedding) > v_threshold
  order by e.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit v_limit;
end;
$$;

revoke all on function public.match_product_images(extensions.vector, float, int, text) from public;

grant execute on function public.match_product_images(extensions.vector, float, int, text) to anon, authenticated;