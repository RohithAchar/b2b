-- Supplier-set margin. The supplier keeps entering a base price; the price buyers
-- see is derived from it plus the supplier's margin, so the base price and the
-- margin must stop being publicly readable.
--
-- Staged rollout (step 1 of 3):
--   1. this migration  - additive: margin column + two pricing views
--   2. app deploy      - read customer prices from the views
--   3. step 3 lockdown - revoke base-price columns from anon/authenticated
--                        (SQL kept in supabase/03_lockdown_base_pricing.sql,
--                        outside migrations/ so db push cannot apply it)
--
-- Step 3 must not be folded in here: revoking the columns before the new code is
-- live breaks the storefront.

-- =============================================================================
-- 1. Margin
-- =============================================================================
-- Company level, so it stays private: anon has no access to companies and
-- companies_select_own restricts authenticated to the owner's own row. The
-- per-product override is intentionally not modelled yet.
alter table public.companies
  add column if not exists margin_pct numeric(5, 2) not null default 0
    constraint companies_margin_pct_check check (margin_pct between 0 and 100);

-- =============================================================================
-- 2. Public customer prices
-- =============================================================================
-- Plain (security-definer) view, matching storefront_suppliers: it reads
-- products.price_per_unit and companies.margin_pct on the view owner's behalf.
-- margin_pct is never projected, so the markup stays secret.
create or replace view public.storefront_prices as
select
  p.id as product_id,
  round(p.price_per_unit * (1 + c.margin_pct / 100), 2) as customer_price,
  case
    when p.sample_price is null then null
    else round(p.sample_price * (1 + c.margin_pct / 100), 2)
  end as customer_sample_price,
  -- Unparseable slab entries are skipped rather than failing the whole view:
  -- one bad row would otherwise take the entire storefront down.
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'min_qty', (s.slab ->> 'min_qty')::integer,
        'price', round(((s.slab ->> 'price')::numeric) * (1 + c.margin_pct / 100), 2)
      )
      order by (s.slab ->> 'min_qty')::integer
    )
    from jsonb_array_elements(p.price_slabs) as s(slab)
    where s.slab ? 'min_qty' and s.slab ? 'price'
  ), '[]'::jsonb) as customer_price_slabs,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', v.id,
        'customer_price', round(v.price * (1 + c.margin_pct / 100), 2)
      )
      order by v.sort, v.id
    )
    from public.product_variants v
    where v.product_id = p.id
  ), '[]'::jsonb) as customer_variant_prices
from public.products p
join public.companies c on c.id = p.supplier_id
where p.status = 'approved' and p.is_hidden = false;

-- The public schema applies default privileges that grant ALL on new objects to
-- anon / authenticated, so revoke before granting or the view stays writable.
-- (Same workaround as 20260906124703_create_categories.sql.)
revoke all on public.storefront_prices from anon, authenticated;
grant select on public.storefront_prices to anon, authenticated;

-- =============================================================================
-- 3. Privileged base prices
-- =============================================================================
-- Views bypass RLS, so the predicate below is the access boundary rather than a
-- second layer of defence. Suppliers see their own products, admins see all.
create or replace view public.supplier_prices as
select
  p.id as product_id,
  p.supplier_id,
  p.price_per_unit,
  p.price_slabs,
  p.sample_price,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('id', v.id, 'label', v.label, 'price', v.price)
      order by v.sort, v.id
    )
    from public.product_variants v
    where v.product_id = p.id
  ), '[]'::jsonb) as variants
from public.products p
where p.supplier_id in (
    select c.id from public.companies c where c.owner_id = (select auth.uid())
  )
  or internal.is_admin();

-- Revoke first: the default privileges would otherwise leave this writable and
-- readable by anon. anon is not granted at all, so the only caller is
-- authenticated, and the predicate above decides what it sees.
revoke all on public.supplier_prices from anon, authenticated;
grant select on public.supplier_prices to authenticated;
