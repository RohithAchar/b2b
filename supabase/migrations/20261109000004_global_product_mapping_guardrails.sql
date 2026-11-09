-- Global product catalogue guardrails (follow-up to ticket 04 migration).
--
-- 1. Make category_id nullable on global_products so catalogue creation is not
--    blocked before the category taxonomy is finalised. Category is a
--    "core attribute" per ticket 04 but should not be mandatory at insert time.
-- 2. Prevent supplier-owned product rows from being assigned to a global
--    product: global_product_id is admin-managed. The existing
--    products_supplier_all policy allows suppliers to insert/update any column
--    on their own products, so add a WITH CHECK guard that only admins may set
--    global_product_id.
-- 3. Document the supplier-to-global mapping strategy: products are mapped by
--    setting global_product_id to the id of a global_products row. This is
--    done by admins (or via a future migration script) and is intentionally
--    one-to-many: one global product can be referenced by many supplier
--    products (same listing sold by multiple suppliers).

-- 1. category_id nullable -----------------------------------------------------
alter table public.global_products
  alter column category_id drop not null;

-- 2. Guard global_product_id writes on products -------------------------------
-- Recreate the supplier products policy with a WITH CHECK that blocks
-- suppliers from setting global_product_id. Admins (internal.is_admin()) are
-- exempt and may set it.
drop policy if exists "products_supplier_all" on public.products;

create policy "products_supplier_all"
  on public.products for all
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
    and (
      global_product_id is null
      or internal.is_admin()
    )
  );

-- Also guard the staff policies (products_insert_staff_draft,
-- products_update_staff_editable) so staff cannot set global_product_id.
drop policy if exists "products_insert_staff_draft" on public.products;
create policy "products_insert_staff_draft"
  on public.products for insert
  to authenticated
  with check (
    status = 'draft'
    and submitted_at is null
    and rejection_note is null
    and reviewed_by is null
    and supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
    and (
      global_product_id is null
      or internal.is_admin()
    )
  );

drop policy if exists "products_update_staff_editable" on public.products;
create policy "products_update_staff_editable"
  on public.products for update
  to authenticated
  using (
    status in ('draft', 'rejected', 'approved')
    and supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
    and (
      global_product_id is null
      or internal.is_admin()
    )
  );

-- 3. Mapping strategy documentation -------------------------------------------
-- Comment on the column to record the mapping intent for future reference.
comment on column public.products.global_product_id is
  'Maps this supplier-owned product to a global_products row. Admin-managed:
  suppliers cannot set this column. One global product may be referenced by
  many supplier products (same listing sold by multiple suppliers).';
