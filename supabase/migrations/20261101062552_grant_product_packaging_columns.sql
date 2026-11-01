-- `products` uses column-level SELECT grants (base price stays private), so new
-- columns must be granted explicitly or PostgREST returns 42501 for any select
-- that includes them.

grant select (carton_units, carton_dimensions, carton_weight_kg)
  on public.products to anon, authenticated;
