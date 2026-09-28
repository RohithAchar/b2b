-- Buyer workflow: enquiries, saved products, recently viewed.
-- All three tables are user-owned with RLS restricting access to the owner.

-- =============================================================================
-- 1. Enquiries
-- =============================================================================
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  supplier_id uuid not null references public.companies (id) on delete cascade,
  quantity integer constraint enquiries_quantity_check check (quantity is null or quantity >= 1),
  message text,
  status text not null default 'pending'
    constraint enquiries_status_check check (status in ('pending', 'quoted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index enquiries_buyer_idx on public.enquiries (buyer_id);
create index enquiries_supplier_idx on public.enquiries (supplier_id);
create index enquiries_product_idx on public.enquiries (product_id);
create index enquiries_status_idx on public.enquiries (status);

alter table public.enquiries enable row level security;

grant select, insert, update, delete on public.enquiries to authenticated;
revoke all on public.enquiries from anon;

-- Buyers can read their own enquiries.
create policy "enquiries_select_buyer_own"
  on public.enquiries for select
  to authenticated
  using (buyer_id = (select auth.uid()));

-- Buyers can create enquiries for themselves.
create policy "enquiries_insert_buyer_own"
  on public.enquiries for insert
  to authenticated
  with check (buyer_id = (select auth.uid()));

-- Buyers can update their own enquiries (e.g. cancel).
create policy "enquiries_update_buyer_own"
  on public.enquiries for update
  to authenticated
  using (buyer_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()));

-- Buyers can delete their own enquiries.
create policy "enquiries_delete_buyer_own"
  on public.enquiries for delete
  to authenticated
  using (buyer_id = (select auth.uid()));

-- Suppliers can read enquiries for their own company.
create policy "enquiries_select_supplier_own"
  on public.enquiries for select
  to authenticated
  using (
    supplier_id in (
      select id from public.companies where owner_id = (select auth.uid())
    )
  );

-- Suppliers can update enquiry status (e.g. mark as quoted).
create policy "enquiries_update_supplier_own"
  on public.enquiries for update
  to authenticated
  using (
    supplier_id in (
      select id from public.companies where owner_id = (select auth.uid())
    )
  )
  with check (
    supplier_id in (
      select id from public.companies where owner_id = (select auth.uid())
    )
  );

-- Admins can read all enquiries.
create policy "enquiries_admin_all"
  on public.enquiries for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- =============================================================================
-- 2. Saved products
-- =============================================================================
create table public.saved_products (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_products_buyer_product_unique unique (buyer_id, product_id)
);

create index saved_products_buyer_idx on public.saved_products (buyer_id);
create index saved_products_product_idx on public.saved_products (product_id);

alter table public.saved_products enable row level security;

grant select, insert, delete on public.saved_products to authenticated;
revoke all on public.saved_products from anon;

create policy "saved_products_select_own"
  on public.saved_products for select
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "saved_products_insert_own"
  on public.saved_products for insert
  to authenticated
  with check (buyer_id = (select auth.uid()));

create policy "saved_products_delete_own"
  on public.saved_products for delete
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "saved_products_admin_all"
  on public.saved_products for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- =============================================================================
-- 3. Recently viewed
-- =============================================================================
create table public.recently_viewed (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  constraint recently_viewed_buyer_product_unique unique (buyer_id, product_id)
);

create index recently_viewed_buyer_idx on public.recently_viewed (buyer_id);
create index recently_viewed_product_idx on public.recently_viewed (product_id);
create index recently_viewed_last_idx on public.recently_viewed (buyer_id, last_viewed_at desc);

alter table public.recently_viewed enable row level security;

grant select, insert, update, delete on public.recently_viewed to authenticated;
revoke all on public.recently_viewed from anon;

create policy "recently_viewed_select_own"
  on public.recently_viewed for select
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "recently_viewed_insert_own"
  on public.recently_viewed for insert
  to authenticated
  with check (buyer_id = (select auth.uid()));

create policy "recently_viewed_update_own"
  on public.recently_viewed for update
  to authenticated
  using (buyer_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()));

create policy "recently_viewed_delete_own"
  on public.recently_viewed for delete
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "recently_viewed_admin_all"
  on public.recently_viewed for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());
