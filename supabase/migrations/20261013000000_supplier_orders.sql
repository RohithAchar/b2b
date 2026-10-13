-- Supplier orders + storefront events for the supplier analytics dashboard.
--
-- `orders` / `order_items` are written by server actions (buyer checkout,
-- currently seed/admin tooling until the checkout flow lands) and read by the
-- owning supplier's dashboard. `storefront_events` is an append-only,
-- PII-free event log (product views, cart adds, orders) that powers sessions
-- and store conversion rate. Buyers and anonymous visitors can only append
-- events; only the owning supplier (and admins) can read them.

-- Orders --------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.companies (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'new'
    constraint orders_status_check
    check (status in ('new', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  subtotal integer not null constraint orders_subtotal_check check (subtotal >= 0),
  item_count integer not null default 0 constraint orders_item_count_check check (item_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_supplier_created_idx on public.orders (supplier_id, created_at desc);
create index orders_buyer_idx on public.orders (buyer_id);
create index orders_supplier_status_idx on public.orders (supplier_id, status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  quantity integer not null constraint order_items_quantity_check check (quantity >= 1),
  unit_price integer not null constraint order_items_unit_price_check check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant select, insert, update, delete on public.orders to authenticated;
revoke all on public.orders from anon;
grant select, insert, update, delete on public.order_items to authenticated;
revoke all on public.order_items from anon;

-- Supplier: full access to orders for their own company.
create policy "orders_supplier_all"
  on public.orders for all
  to authenticated
  using (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

-- Buyer: read own orders. Creation and updates go through server actions.
create policy "orders_buyer_select_own"
  on public.orders for select
  to authenticated
  using (buyer_id = ((select auth.uid())));

-- Buyer: create own orders (server-side checkout inserts as the buyer, so
-- RLS must permit it; the supplier side is application-validated).
create policy "orders_buyer_insert_own"
  on public.orders for insert
  to authenticated
  with check (buyer_id = ((select auth.uid())));

create policy "orders_admin_all"
  on public.orders for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Order items follow their parent order's ownership.
create policy "order_items_supplier_all"
  on public.order_items for all
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.companies c on c.id = o.supplier_id
      where o.id = order_items.order_id and c.owner_id = ((select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      join public.companies c on c.id = o.supplier_id
      where o.id = order_items.order_id and c.owner_id = ((select auth.uid()))
    )
  );

create policy "order_items_buyer_select_own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.buyer_id = ((select auth.uid()))
    )
  );

create policy "order_items_buyer_insert_own"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.buyer_id = ((select auth.uid()))
    )
  );

create policy "order_items_admin_all"
  on public.order_items for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Storefront events (append-only analytics) ----------------------------------
create table public.storefront_events (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  -- Client-generated opaque session id (no PII). Anonymous visitors get one
  -- per browser tab lifetime; signed-in buyers reuse their stored one.
  session_id text not null,
  event text not null
    constraint storefront_events_event_check
    check (event in ('view', 'cart', 'order')),
  buyer_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index storefront_events_supplier_created_idx
  on public.storefront_events (supplier_id, created_at desc);
create index storefront_events_session_idx
  on public.storefront_events (supplier_id, session_id);

alter table public.storefront_events enable row level security;

grant insert, select on public.storefront_events to authenticated;
grant insert on public.storefront_events to anon;

-- Anyone (including anonymous visitors) may append events; nothing sensitive
-- is stored on the row, and no read access is granted here.
create policy "storefront_events_insert_any"
  on public.storefront_events for insert
  to anon, authenticated
  with check (true);

-- Supplier: read events for their own company.
create policy "storefront_events_supplier_select"
  on public.storefront_events for select
  to authenticated
  using (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

create policy "storefront_events_admin_all"
  on public.storefront_events for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());
