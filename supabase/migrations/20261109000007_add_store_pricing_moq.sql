-- Store-specific pricing and MOQ.
-- Adds per-store price and minimum order quantity to store_products so the
-- storefront resolves prices from the active store, never from client input.
-- Blocked by tickets 05 and 06.

-- 1. Add per-store price and MOQ to store_products ---------------------------
alter table public.store_products
  add column price_per_unit numeric(12, 2)
    constraint store_products_price_check
    check (price_per_unit is null or price_per_unit > 0),
  add column moq integer
    constraint store_products_moq_check
    check (moq is null or moq >= 1);

-- 2. Price resolution function: canonical server-side price for a store product.
-- Returns null when the product is not listed at the store or the store is
-- inactive. Callers must never trust client-supplied prices.
create or replace function public.store_product_price(
  p_store_id uuid,
  p_global_product_id uuid
)
returns numeric(12, 2)
language sql
stable
set search_path = ''
as $$
  select sp.price_per_unit
  from public.store_products sp
  join public.stores s on s.id = sp.store_id
  where sp.store_id = p_store_id
    and sp.global_product_id = p_global_product_id
    and sp.is_listed
    and s.status = 'active'
  limit 1;
$$;

revoke all on function public.store_product_price(uuid, uuid) from public;
grant execute on function public.store_product_price(uuid, uuid) to anon, authenticated, service_role;

-- 3. Variant price resolution: store variant override takes precedence,
--    falling back to the store product price.
create or replace function public.store_variant_price(
  p_store_product_id uuid,
  p_variant_label text
)
returns numeric(12, 2)
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select spv.price_override
     from public.store_product_variants spv
     where spv.store_product_id = p_store_product_id
       and spv.variant_label = p_variant_label
       and spv.is_available
     limit 1),
    (select sp.price_per_unit
     from public.store_products sp
     join public.stores s on s.id = sp.store_id
     where sp.id = p_store_product_id
       and sp.is_listed
       and s.status = 'active'
     limit 1)
  );
$$;

revoke all on function public.store_variant_price(uuid, text) from public;
grant execute on function public.store_variant_price(uuid, text) to anon, authenticated, service_role;
