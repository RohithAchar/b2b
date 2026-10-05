-- Buyer cart: one row per (buyer, product, variant).
-- Owner-only RLS, mirroring saved_products. Authenticated buyers manage their
-- own rows; anon has no access. Minimum cart value (₹2,500 shared subtotal)
-- is enforced in application code (lib/buyer/cart.ts), not here, because the
-- threshold compares priced lines, not stored rows.
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  quantity integer not null constraint cart_items_quantity_check check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- NULLS NOT DISTINCT so base-product lines (variant_id null) also dedupe:
  -- plain UNIQUE would let NULLs repeat and allow duplicate base lines.
  constraint cart_items_buyer_product_variant_unique unique nulls not distinct (buyer_id, product_id, variant_id)
);

create index cart_items_buyer_idx on public.cart_items (buyer_id);
create index cart_items_product_idx on public.cart_items (product_id);

alter table public.cart_items enable row level security;

grant select, insert, update, delete on public.cart_items to authenticated;
revoke all on public.cart_items from anon;

create policy "cart_items_select_own"
  on public.cart_items for select
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "cart_items_insert_own"
  on public.cart_items for insert
  to authenticated
  with check (buyer_id = (select auth.uid()));

create policy "cart_items_update_own"
  on public.cart_items for update
  to authenticated
  using (buyer_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()));

create policy "cart_items_delete_own"
  on public.cart_items for delete
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "cart_items_admin_all"
  on public.cart_items for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());
