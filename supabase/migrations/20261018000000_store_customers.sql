-- Supplier store customers (Audience page): manually added, CSV-imported,
-- and order-linked buyer records. One row per (supplier, person); duplicates
-- are allowed so the UI can flag them for review instead of silently merging.
--
-- Classification (see lib/supplier/customers.ts): source = 'import' reads as
-- Imported; a linked buyer with more than one order reads as Returning;
-- everyone else reads as New. Order counts and sales always come from the
-- orders table, never from columns here, so redemptions stay truthful.

create table public.store_customers (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.companies (id) on delete cascade,
  -- Linked buyer when the person has an account; null for manual/import rows
  -- that have not been matched yet.
  buyer_id uuid references public.profiles (id) on delete set null,
  name text not null,
  phone text not null,
  email text,
  city text,
  source text not null default 'manual'
    constraint store_customers_source_check
    check (source in ('manual', 'import', 'order')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index store_customers_supplier_created_idx
  on public.store_customers (supplier_id, created_at desc);
create index store_customers_supplier_phone_idx
  on public.store_customers (supplier_id, phone);
create index store_customers_supplier_email_idx
  on public.store_customers (supplier_id, email);
create index store_customers_buyer_idx on public.store_customers (buyer_id);

alter table public.store_customers enable row level security;

grant select, insert, update, delete on public.store_customers to authenticated;
revoke all on public.store_customers from anon;

-- Supplier: full access to their own customer records. Personal data in
-- these rows is never exposed publicly or to buyers.
create policy "store_customers_supplier_all"
  on public.store_customers for all
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

create policy "store_customers_admin_all"
  on public.store_customers for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());
