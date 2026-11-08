-- Store domain: multi-tenant storefronts alongside supplier companies.
-- Adds a `stores` table for the four initial storefronts (D2H Core,
-- D2H Select, Ecom Package, Dropshopping). Existing supplier tables and
-- workflows remain fully operational.

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null
    constraint stores_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active'
    constraint stores_status_check
    check (status in ('active', 'inactive')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_slug_unique unique (slug)
);

create index stores_slug_idx on public.stores (slug);
create index stores_status_idx on public.stores (status);

alter table public.stores enable row level security;

-- New tables are NOT auto-exposed to the Data API. Grant explicitly, then
-- lock rows down with RLS below.
grant select on public.stores to anon, authenticated;

-- Public read: storefront and dashboard can list active stores.
create policy "stores_select_public"
  on public.stores for select
  to anon, authenticated
  using (status = 'active');

-- Admins manage all stores (create, edit, activate, deactivate).
create policy "stores_admin_all"
  on public.stores for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Keep updated_at fresh on edits, mirroring the products/table pattern.
create trigger set_stores_updated_at
  before update on public.stores
  for each row execute function internal.set_updated_at();

-- Seed the four initial stores. Idempotent via on conflict (slug).
insert into public.stores (name, slug, status, description) values
  ('D2H Core', 'd2h-core', 'active', 'Core wholesale catalogue for everyday B2B sourcing.'),
  ('D2H Select', 'd2h-select', 'active', 'Curated winning products and promotional deals.'),
  ('Ecom Package', 'ecom-package', 'active', 'Packaging and shipping supplies for e-commerce sellers.'),
  ('Dropshopping', 'dropshopping', 'active', 'Dropshipping-ready catalogue with low MOQs.')
on conflict (slug) do nothing;
