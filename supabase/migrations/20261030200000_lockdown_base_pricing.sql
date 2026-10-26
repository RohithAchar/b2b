-- Step 3 of the margin rollout: hide supplier base prices from the Data API.
--
-- The app already reads customer prices from storefront_prices and private base
-- prices from supplier_prices, so direct base-price columns are no longer needed
-- by anon or authenticated clients.
--
-- What it does: drops SELECT on products / product_variants for anon AND
-- authenticated, then re-grants every column except the base price. Column-level
-- grants keep the existing table reads working, so:
--   * filters, order, range, textSearch and count=exact still hit products' indexes
--   * PostgREST embeds (category:, images:, variants:) keep resolving via the FKs
--   * write grants are untouched, so supplier CRUD and the security-definer
--     replace_product_variants RPC are unaffected
--   * the anon policies on product_images / product_variants subquery only
--     products.id, products.status and products.is_hidden, all still granted
--
-- Base prices stay reachable for the owning supplier and admins through the
-- supplier_prices view instead.

-- =============================================================================
-- products: everything except price_per_unit and price_slabs
-- =============================================================================
revoke select on public.products from anon, authenticated;

grant select (
  id,
  supplier_id,
  category_id,
  title,
  description,
  brand,
  seller_sku,
  hsn_code,
  unit,
  moq,
  stock_qty,
  negotiable,
  sample_available,
  lead_time_days,
  gst_rate,
  attributes,
  certifications,
  packaging_details,
  warranty_return,
  youtube_url,
  youtube_id,
  status,
  is_hidden,
  rejection_note,
  submitted_at,
  reviewed_by,
  created_at,
  updated_at,
  seo_title,
  seo_description,
  seo_image_path
) on public.products to anon, authenticated;

-- =============================================================================
-- product_variants: everything except price
-- =============================================================================
revoke select on public.product_variants from anon, authenticated;

grant select (
  id,
  product_id,
  label,
  attrs,
  seller_sku,
  moq,
  stock_qty,
  image_index,
  sort,
  created_at
) on public.product_variants to anon, authenticated;

-- =============================================================================
-- Sanity checks (run after applying; both should return 0 rows)
-- =============================================================================
-- Base price still readable by anon (expected: no rows):
--   select a.attname
--   from pg_attribute a
--   where a.attrelid = 'public.products'::regclass
--     and a.attnum > 0 and not a.attisdropped
--     and has_column_privilege('anon', 'public.products', a.attname, 'select')
--     and a.attname in ('price_per_unit', 'price_slabs');
--
-- storefront_prices still readable by anon (expected: a count):
--   select count(*) from public.storefront_prices;
--
-- After this lands, `select=*` against products or product_variants fails with
-- 42501 permission denied. Every select in the codebase is explicit, but new
-- code must list columns and must never ask for the base price as anon or as a
-- signed-in buyer (that path runs as `authenticated`, not `anon`).
