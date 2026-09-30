-- =============================================================================
-- Image (visual) product search.
--
-- Buyers upload a reference image; the app embeds it with a multimodal model
-- (see lib/embeddings.ts) and stores the vector here. Product images are
-- embedded the same way, and the storefront ranks products by cosine distance
-- between the query vector and each product's closest image vector.
--
-- Vectors from different models are not comparable, so `model` is stored on
-- every row and the ranking function only ever compares rows sharing one
-- model. Changing IMAGE_EMBEDDING_MODEL in lib/embeddings.ts therefore
-- requires a full re-index, not just new rows.
-- =============================================================================

-- pgvector lives in `extensions` (Supabase's convention, and the schema listed
-- in supabase/config.toml extra_search_path). Created defensively because no
-- earlier migration in this repo references that schema, so its presence is not
-- otherwise guaranteed by the migration history.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- Product image embeddings
-- -----------------------------------------------------------------------------

create table public.product_image_embeddings (
  product_image_id uuid primary key references public.product_images (id) on delete cascade,
  -- Denormalised from product_images so ranking and RLS do not need a join.
  product_id uuid not null references public.products (id) on delete cascade,
  model text not null,
  -- Must match IMAGE_EMBEDDING_DIM in lib/embeddings.ts. 1024 floats = 4KB.
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now()
);

create index product_image_embeddings_model_idx
  on public.product_image_embeddings (model);

create index product_image_embeddings_product_idx
  on public.product_image_embeddings (product_id);

-- Approximate nearest-neighbour index for when the catalog outgrows the exact
-- scan below. The ranking function does not rely on it today: it computes
-- exact distances, which is both correct and fast at current catalog size.
create index product_image_embeddings_hnsw
  on public.product_image_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

comment on table public.product_image_embeddings is
  'Cosine embeddings of product images, one row per product_images row. Model id matches IMAGE_EMBEDDING_MODEL in lib/embeddings.ts.';

alter table public.product_image_embeddings enable row level security;

-- Matches public.product_images/product_images_select_approved (as refined in
-- 20260924120000_editable_and_hideable_products.sql): approved AND not hidden,
-- so a draft, rejected or hidden product can never surface through image search.
create policy "product_image_embeddings_select_approved"
  on public.product_image_embeddings for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_image_embeddings.product_id
        and p.status = 'approved'
        and p.is_hidden = false
    )
  );

-- Suppliers index their own images from the product editor, best-effort.
-- Mirrors public.product_images/product_images_supplier_all.
create policy "product_image_embeddings_supplier_all"
  on public.product_image_embeddings for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.companies c on c.id = p.supplier_id
      where p.id = product_image_embeddings.product_id
        and c.owner_id = ((select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.products p
      join public.companies c on c.id = p.supplier_id
      where p.id = product_image_embeddings.product_id
        and c.owner_id = ((select auth.uid()))
    )
  );

-- New tables are not auto-exposed to the Data API; grant explicitly
-- (see 20260906091225_create_profiles.sql). Image search is sign-in only, so
-- anon gets no grant at all here.
revoke all on public.product_image_embeddings from anon;
grant select, insert, update on public.product_image_embeddings to authenticated;

-- -----------------------------------------------------------------------------
-- Query vectors
--
-- The query image itself is never stored, only the vector it produced. The id
-- travels in the URL (?img=<uuid>) so filter and pagination links keep working
-- without re-uploading or re-embedding anything. Ownership is enforced by RLS,
-- so a vector is readable only by the buyer who uploaded it. No admin policy:
-- there is no operational use case for reading buyer query vectors, and
-- service_role (used by the backfill script) bypasses RLS regardless.
-- -----------------------------------------------------------------------------

create table public.image_search_queries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  model text not null,
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),
  -- Rows are pruned opportunistically by the search action; no cron exists.
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index image_search_queries_buyer_idx
  on public.image_search_queries (buyer_id, created_at desc);

comment on table public.image_search_queries is
  'Recent search-by-image query vectors. Only the vector is retained; the source image is discarded. Rows expire 24h after creation.';

alter table public.image_search_queries enable row level security;

create policy "image_search_queries_own"
  on public.image_search_queries for all
  to authenticated
  using (buyer_id = ((select auth.uid())))
  with check (buyer_id = ((select auth.uid())));

revoke all on public.image_search_queries from anon;
grant select, insert, delete on public.image_search_queries to authenticated;

-- -----------------------------------------------------------------------------
-- Ranking
--
-- PostgREST cannot express the pgvector distance operator, so similarity search
-- has to go through an RPC. This is SECURITY INVOKER (the default) on purpose:
-- the caller's RLS does the filtering, so a hidden product can never surface,
-- and a buyer can only ever resolve a query vector they own. Yields no rows for
-- an unknown, foreign or expired query id.
--
-- The operator is schema-qualified via OPERATOR(extensions.<=>) so this can
-- keep search_path = '', matching every other function in this schema.
-- -----------------------------------------------------------------------------

create or replace function public.search_products_by_image(
  p_query_id uuid,
  p_match_count int default 24,
  p_offset int default 0
)
returns table (product_id uuid, distance double precision, total_count bigint)
language sql
stable
set search_path = ''
as $$
  with q as (
    select model, embedding
    from public.image_search_queries
    where id = p_query_id
  )
  select
    e.product_id,
    min(e.embedding OPERATOR(extensions.<=>) q.embedding)::double precision as distance,
    count(*) over ()::bigint as total_count
  from public.product_image_embeddings e
  join q on q.model = e.model
  group by e.product_id
  order by min(e.embedding OPERATOR(extensions.<=>) q.embedding) asc
  limit greatest(p_match_count, 0)
  offset greatest(p_offset, 0)
$$;

comment on function public.search_products_by_image(uuid, int, int) is
  'Ranks products by cosine distance from a buyer-owned query vector. Exact scan, RLS-filtered. Returns ranked product ids, their distance, and the total number of distinct matches for pagination.';

revoke all on function public.search_products_by_image(uuid, int, int) from public;
grant execute on function public.search_products_by_image(uuid, int, int) to authenticated;
