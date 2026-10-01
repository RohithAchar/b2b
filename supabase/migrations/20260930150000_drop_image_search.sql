-- =============================================================================
-- Drop image (visual) product search.
--
-- Removes everything introduced for search-by-image: the two tables, their RLS
-- policies and indexes (all dropped implicitly with the tables), and the
-- ranking RPC.
--
-- Written to be re-runnable, so this migration is a no-op on an environment
-- where the feature was never created. Note that `drop policy ... on <table>`
-- is NOT conditional on the table existing -- it raises 42P01 -- so policies
-- are deliberately not dropped by name here. Dropping the table removes them.
--
-- The `extensions.vector` extension and the `extensions` schema are
-- intentionally left in place: both are shared infrastructure rather than part
-- of this feature, and the extension is harmless once unused.
-- =============================================================================

-- Ranking RPC first, since it reads both tables.
drop function if exists public.search_products_by_image(uuid, int, int);

-- Product image embeddings, including product_image_embeddings_hnsw and the
-- per-row grants. The 57 rows written by scripts/backfill-image-embeddings.mjs
-- go with it; those vectors are not recoverable without re-running the
-- backfill against the model that created them.
drop table if exists public.product_image_embeddings;

-- Buyer query vectors. Only ever held vectors, never the query image.
drop table if exists public.image_search_queries;
