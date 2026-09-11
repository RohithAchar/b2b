-- Storefront: public read access for product variants and verified suppliers.

-- 1. Product variants: allow anon/authenticated read for approved products.
grant select on public.product_variants to anon, authenticated;

create policy "product_variants_select_approved"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status = 'approved'
    )
  );

-- 2. Companies: allow anon/authenticated read for verified suppliers.
grant select on public.companies to anon, authenticated;

create policy "companies_select_verified"
  on public.companies for select
  to anon, authenticated
  using (kyb_status = 'verified');

-- 3. Indexes for storefront queries.
create index products_title_search_idx on public.products
  using gin (to_tsvector('english', title));
create index products_created_at_idx on public.products (created_at desc);
