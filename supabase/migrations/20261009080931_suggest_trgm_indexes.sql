-- =============================================================================
-- Search suggestions: trigram indexes for as-you-type substring matches.
--
-- `/api/search/suggest` matches with `ilike '%term%'` (wildcards on both
-- sides) against products.title and categories.name. Neither a btree index
-- nor the full-text GIN index on to_tsvector(title) (20260910120000) can
-- serve a leading-wildcard LIKE — without trigram support every keystroke
-- scans the whole table. pg_trgm indexes three-letter fragments, turning
-- substring matches into index lookups.
--
-- Follows the pgvector migration convention (20261002120000): extension
-- created defensively in the `extensions` schema; both statements are no-ops
-- when already installed.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create index if not exists products_title_trgm_idx
  on public.products using gin (title gin_trgm_ops);

create index if not exists categories_name_trgm_idx
  on public.categories using gin (name gin_trgm_ops);
