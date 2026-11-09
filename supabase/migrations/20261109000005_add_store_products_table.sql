-- Store-product assignments: associate global products with individual stores.
-- Controls listing (listed/unlisted) per store. One row per (store, product).
-- Blocked by ticket 04 (global_products table exists).

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  global_product_id uuid not null references public.global_products (id) on delete cascade,
  is_listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_products_store_product_unique
    unique (store_id, global_product_id)
);

create index store_products_store_idx on public.store_products (store_id);
create index store_products_global_product_idx on public.store_products (global_product_id);
create index store_products_store_listed_idx on public.store_products (store_id, is_listed);

alter table public.store_products enable row level security;

-- New tables are NOT auto-exposed to the Data API. Grant explicitly, then
-- lock rows down with RLS below.
grant select on public.store_products to anon, authenticated;

-- Public read: listed products at active stores only.
create policy "store_products_select_listed"
  on public.store_products for select
  to anon, authenticated
  using (
    is_listed
    and exists (
      select 1 from public.stores s
      where s.id = store_products.store_id and s.status = 'active'
    )
  );

-- Admins manage all store-product assignments.
create policy "store_products_admin_all"
  on public.store_products for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Keep updated_at fresh on edits, mirroring the products/table pattern.
create trigger set_store_products_updated_at
  before update on public.store_products
  for each row execute function internal.set_updated_at();
