-- Security: expose only safe company columns to the public via views.
-- The `companies_select_verified` policy leaks PAN, GSTIN, bank details to
-- anon and any authenticated user. Drop it and replace with read-only views
-- that expose only the storefront-safe subset.
--
-- Also adds an audit_logs table for state-change tracking.

-- 1. Audit log table -----------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_status text,
  new_status text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Admins can read everything; no one else needs audit_logs.
grant select on public.audit_logs to authenticated;

create policy "audit_logs_admin_select"
  on public.audit_logs for select
  to authenticated
  using (internal.is_admin());

-- 2. Storefront suppliers view -------------------------------------------------
-- Verified companies only, safe columns only. No PAN, GSTIN, bank details.
create or replace view public.storefront_suppliers as
select
  id,
  business_name,
  city,
  state,
  logo_path,
  created_at
from public.companies
where kyb_status = 'verified';

grant select on public.storefront_suppliers to anon, authenticated;

-- 3. Supplier featured images view ---------------------------------------------
-- Top 3 product images per verified supplier, used by the homepage.
create or replace view public.supplier_featured_images as
select
  c.id as supplier_id,
  pi.path as image_path,
  pi.sort
from public.companies c
join public.products p on p.supplier_id = c.id and p.status = 'approved'
join public.product_images pi on pi.product_id = p.id
where c.kyb_status = 'verified'
  and p.created_at = (
    select max(p2.created_at)
    from public.products p2
    where p2.supplier_id = c.id and p2.status = 'approved'
  )
order by c.id, pi.sort
limit 100;

grant select on public.supplier_featured_images to anon, authenticated;

-- 4. Category product counts view ----------------------------------------------
-- Approved product count per category (top-level categories only).
create or replace view public.category_product_counts as
select
  cat.id as category_id,
  coalesce(sub_counts.sub_count, 0) + coalesce(approved_counts.count, 0) as product_count
from public.categories cat
left join (
  select
    p.category_id,
    count(*) as count
  from public.products p
  where p.status = 'approved'
  group by p.category_id
) approved_counts on approved_counts.category_id = cat.id
left join (
  select
    parent.id as parent_id,
    count(*) as sub_count
  from public.categories parent
  join public.categories sub on sub.parent_id = parent.id
  join public.products p on p.category_id = sub.id and p.status = 'approved'
  group by parent.id
) sub_counts on sub_counts.parent_id = cat.id
where cat.parent_id is null
group by cat.id, sub_counts.sub_count, approved_counts.count;

grant select on public.category_product_counts to anon, authenticated;

-- 5. Drop the dangerous company SELECT policy -----------------------------------
-- This policy lets anon + any authenticated user read ALL company columns
-- (PAN, GSTIN, bank_account, etc.) for verified suppliers.
drop policy if exists "companies_select_verified" on public.companies;

-- 6. Revoke direct company table access from anon --------------------------------
-- Storefront reads now go through storefront_suppliers instead.
revoke select on public.companies from anon;

-- Keep authenticated SELECT for the owner-only and admin policies
-- (companies_select_own and companies_admin_all still use authenticated).
