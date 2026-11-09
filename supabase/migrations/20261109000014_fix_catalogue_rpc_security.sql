-- The storefront catalogue RPC is invoked by the anon (public) client but
-- reads from public.products, which anon has no direct SELECT grant on. Make
-- the function SECURITY DEFINER so it runs with elevated privileges (and
-- filters to approved/non-hidden products internally). Also drop the stale
-- 13-parameter overload left behind by the previous create-or-replace, which
-- did not include p_store_id.
drop function if exists public.list_storefront_products(
  text, text, text, numeric, numeric, integer, integer,
  boolean, boolean, boolean, uuid[], jsonb, integer
);

alter function public.list_storefront_products(
  text, text, text, numeric, numeric, integer, integer,
  boolean, boolean, boolean, uuid[], jsonb, integer, uuid
) security definer;

alter function public.list_storefront_products(
  text, text, text, numeric, numeric, integer, integer,
  boolean, boolean, boolean, uuid[], jsonb, integer, uuid
) set search_path = '';
