-- Store scoping: each product belongs to one store. Products created from
-- a store's dashboard are assigned to that store; the storefront shows only
-- the products belonging to the store being browsed (/ = core, /select = select).
alter table public.products
  add column store_id uuid references public.stores (id) on delete set null;

create index products_store_idx on public.products (store_id);

-- Seed existing products to D2H Core so they keep showing on the homepage.
update public.products
set store_id = (select id from public.stores where slug = 'd2h-core')
where store_id is null;

-- Allow suppliers to set store_id on their own products (it is derived from
-- the dashboard route, not user input, but the column must be writable).
-- RLS is already handled by products_supplier_all policy which allows all
-- columns for own products.