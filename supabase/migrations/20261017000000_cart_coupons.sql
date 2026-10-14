-- Buyer cart coupons: one applied coupon code per (buyer, supplier).
--
-- Applied codes live here instead of localStorage so they survive navigation,
-- reloads and devices. Only the CODE is stored — discounts are always
-- re-derived server-side via quoteCoupon (codes can expire, hit limits or be
-- deactivated at any time). The future checkout consumes these rows when it
-- creates orders and clears them with the bought lines.

create table public.cart_coupons (
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  supplier_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  constraint cart_coupons_buyer_supplier_unique unique (buyer_id, supplier_id)
);

create index cart_coupons_buyer_idx on public.cart_coupons (buyer_id);

alter table public.cart_coupons enable row level security;

grant select, insert, update, delete on public.cart_coupons to authenticated;
revoke all on public.cart_coupons from anon;

create policy "cart_coupons_select_own"
  on public.cart_coupons for select
  to authenticated
  using (buyer_id = ((select auth.uid())));

create policy "cart_coupons_insert_own"
  on public.cart_coupons for insert
  to authenticated
  with check (buyer_id = ((select auth.uid())));

create policy "cart_coupons_update_own"
  on public.cart_coupons for update
  to authenticated
  using (buyer_id = ((select auth.uid())))
  with check (buyer_id = ((select auth.uid())));

create policy "cart_coupons_delete_own"
  on public.cart_coupons for delete
  to authenticated
  using (buyer_id = ((select auth.uid())));

create policy "cart_coupons_admin_all"
  on public.cart_coupons for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());
