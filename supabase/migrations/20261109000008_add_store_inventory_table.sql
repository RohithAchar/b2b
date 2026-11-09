-- Store-specific inventory.
-- Tracks stock independently for each store and variant. Supports reservation
-- (decrement during checkout) and server-side stock validation to prevent
-- overselling.
-- Blocked by tickets 05 and 06.

create table public.store_inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  global_product_id uuid not null references public.global_products (id) on delete cascade,
  variant_label text,
  stock_qty integer not null default 0
    constraint store_inventory_stock_check
    check (stock_qty >= 0),
  reserved_qty integer not null default 0
    constraint store_inventory_reserved_check
    check (reserved_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_inventory_store_product_variant_unique
    unique (store_id, global_product_id, variant_label)
);

create index store_inventory_store_idx on public.store_inventory (store_id);
create index store_inventory_product_idx on public.store_inventory (global_product_id);
create index store_inventory_store_product_idx on public.store_inventory (store_id, global_product_id);

alter table public.store_inventory enable row level security;

-- New tables are NOT auto-exposed to the Data API. Grant explicitly, then
-- lock rows down with RLS below.
grant select on public.store_inventory to anon, authenticated;

-- Public read: available stock at active stores for listed products.
create policy "store_inventory_select_available"
  on public.store_inventory for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.store_products sp
      join public.stores s on s.id = sp.store_id
      where sp.store_id = store_inventory.store_id
        and sp.global_product_id = store_inventory.global_product_id
        and sp.is_listed
        and s.status = 'active'
        and (
          store_inventory.variant_label is null
          or exists (
            select 1 from public.store_product_variants spv
            where spv.store_product_id = sp.id
              and spv.variant_label = store_inventory.variant_label
              and spv.is_available
          )
        )
    )
  );

-- Admins manage all store inventory.
create policy "store_inventory_admin_all"
  on public.store_inventory for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Keep updated_at fresh on edits.
create trigger set_store_inventory_updated_at
  before update on public.store_inventory
  for each row execute function internal.set_updated_at();

-- Stock reservation function: atomically reserve qty, returning the remaining
-- available stock or null if insufficient. Used by checkout to prevent
-- overselling.
create or replace function public.reserve_store_stock(
  p_store_id uuid,
  p_global_product_id uuid,
  p_variant_label text,
  p_qty integer
)
returns integer
language sql
as $$
  update public.store_inventory
  set reserved_qty = reserved_qty + p_qty,
      updated_at = now()
  where store_id = p_store_id
    and global_product_id = p_global_product_id
    and (variant_label is not distinct from p_variant_label)
    and stock_qty - reserved_qty >= p_qty
  returning stock_qty - reserved_qty;
$$;

revoke all on function public.reserve_store_stock(uuid, uuid, text, integer) from public;
grant execute on function public.reserve_store_stock(uuid, uuid, text, integer) to authenticated, service_role;

-- Stock release function: release a previously reserved quantity.
create or replace function public.release_store_stock(
  p_store_id uuid,
  p_global_product_id uuid,
  p_variant_label text,
  p_qty integer
)
returns void
language sql
as $$
  update public.store_inventory
  set reserved_qty = greatest(reserved_qty - p_qty, 0),
      updated_at = now()
  where store_id = p_store_id
    and global_product_id = p_global_product_id
    and (variant_label is not distinct from p_variant_label)
    and reserved_qty >= p_qty;
$$;

revoke all on function public.release_store_stock(uuid, uuid, text, integer) from public;
grant execute on function public.release_store_stock(uuid, uuid, text, integer) to authenticated, service_role;

-- Stock decrement function: permanently reduce stock (after payment confirmed).
create or replace function public.decrement_store_stock(
  p_store_id uuid,
  p_global_product_id uuid,
  p_variant_label text,
  p_qty integer
)
returns void
language sql
as $$
  update public.store_inventory
  set stock_qty = greatest(stock_qty - p_qty, 0),
      reserved_qty = greatest(reserved_qty - p_qty, 0),
      updated_at = now()
  where store_id = p_store_id
    and global_product_id = p_global_product_id
    and (variant_label is not distinct from p_variant_label)
    and stock_qty >= p_qty;
$$;

revoke all on function public.decrement_store_stock(uuid, uuid, text, integer) from public;
grant execute on function public.decrement_store_stock(uuid, uuid, text, integer) to authenticated, service_role;
