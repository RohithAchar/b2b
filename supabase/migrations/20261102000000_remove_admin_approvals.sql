-- Remove admin approval steps: suppliers are internal, so submissions go live
-- (and KYB applications verify) immediately without admin review.

create or replace function public.submit_product_for_approval(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier uuid;
begin
  select supplier_id into v_supplier from public.products where id = p_product_id;
  if v_supplier is null then
    raise exception 'Product not found';
  end if;
  if not exists (
    select 1 from public.companies
    where id = v_supplier and owner_id = (select auth.uid())
  ) then
    raise exception 'Not your product';
  end if;
  if not exists (
    select 1 from public.products
    where id = p_product_id and status in ('draft', 'rejected')
  ) then
    raise exception 'Product is not in a submittable state';
  end if;

  perform internal.validate_product_for_approval(p_product_id);

  perform set_config('app.internal_guard_bypass', 'on', true);
  update public.products
  set status = 'approved',
      submitted_at = now(),
      rejection_note = null,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_product_id;
end;
$$;

create or replace function public.submit_kyb(
  p_company_id uuid,
  p_submitted_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.companies where id = p_company_id;
  if v_owner is null then
    raise exception 'Company not found';
  end if;
  if v_owner != (select auth.uid()) then
    raise exception 'Not your company';
  end if;
  if not exists (
    select 1 from public.companies
    where id = p_company_id and kyb_status in ('draft', 'rejected')
  ) then
    raise exception 'Company is not in a submittable state';
  end if;

  perform set_config('app.internal_guard_bypass', 'on', true);
  update public.companies
  set kyb_status = 'verified',
      submitted_at = p_submitted_at,
      verified_at = now(),
      reviewed_by = (select auth.uid()),
      rejection_note = null
  where id = p_company_id;
end;
$$;