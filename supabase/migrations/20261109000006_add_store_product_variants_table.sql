-- Store-specific product variant configuration.
-- A store can override variant availability, price, MOQ and stock for each
-- of its assigned products. Shared variant information stays in the global
-- catalogue; store-level overrides never leak to another store.
-- Blocked by ticket 05 (store_products table exists).

create table public.store_product_variants (
  id uuid primary key default gen_random_uuid(),
  store_product_id uuid not null references public.store_products (id) on delete cascade,
  variant_label text not null
    constraint store_product_variants_label_check
    check (length(btrim(variant_label)) >= 1),
  is_available boolean not null default true,
  price_override numeric(12, 2)
    constraint store_product_variants_price_check
    check (price_override is null or price_override > 0),
  moq_override integer
    constraint store_product_variants_moq_check
    check (moq_override is null or moq_override >= 1),
  stock_override integer not null default 0
    constraint store_product_variants_stock_check
    check (stock_override >= 0),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_product_variants_store_product_label_unique
    unique (store_product_id, variant_label)
);

create index store_product_variants_store_product_idx
  on public.store_product_variants (store_product_id);

alter table public.store_product_variants enable row level security;

-- New tables are NOT auto-exposed to the Data API. Grant explicitly, then
-- lock rows down with RLS below.
grant select on public.store_product_variants to anon, authenticated;

-- Public read: variants of listed products at active stores.
create policy "store_product_variants_select_listed"
  on public.store_product_variants for select
  to anon, authenticated
  using (
    is_available
    and exists (
      select 1 from public.store_products sp
      join public.stores s on s.id = sp.store_id
      where sp.id = store_product_variants.store_product_id
        and sp.is_listed
        and s.status = 'active'
    )
  );

-- Admins manage all store variant configuration.
create policy "store_product_variants_admin_all"
  on public.store_product_variants for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Keep updated_at fresh on edits.
create trigger set_store_product_variants_updated_at
  before update on public.store_product_variants
  for each row execute function internal.set_updated_at();
