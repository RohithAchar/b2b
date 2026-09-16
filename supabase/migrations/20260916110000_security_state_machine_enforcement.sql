-- Security: state-machine enforcement via triggers + RPCs.
--
-- Suppliers can only INSERT products in 'draft' status and transition
-- draft→pending (submit). Admins transition pending→approved/rejected.
-- Suppliers can never set reviewed_at, reviewed_by, or rejection_note.
--
-- Companies: suppliers set kyb_status='pending' on submit via RPC.
-- Admins transition pending→verified or pending→rejected via RPC.
-- Direct UPDATE is blocked for non-admin, non-bypassrls roles.

-- =============================================================================
-- 1. Company guard trigger — blocks approval-metadata writes from non-admins ====
-- =============================================================================
create or replace function internal.guard_company_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role (seed) and admin bypass this guard.
  if current_setting('role') = 'supabase_admin' then
    return new;
  end if;
  if internal.is_admin() then
    return new;
  end if;

  -- Suppliers may not touch approval metadata.
  if new.kyb_status is distinct from old.kyb_status then
    raise exception 'kyb_status can only be changed by an administrator';
  end if;
  if new.verified_at is distinct from old.verified_at then
    raise exception 'verified_at can only be changed by an administrator';
  end if;
  if new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'reviewed_by can only be changed by an administrator';
  end if;
  if new.rejection_note is distinct from old.rejection_note then
    raise exception 'rejection_note can only be changed by an administrator';
  end if;
  if new.submitted_at is distinct from old.submitted_at then
    raise exception 'submitted_at can only be changed by an administrator';
  end if;

  -- owner_id is immutable.
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_company_approval_fields on public.companies;

create trigger guard_company_approval_fields
  before update on public.companies
  for each row execute function internal.guard_company_approval_fields();

-- =============================================================================
-- 2. Product guard trigger — blocks approval-metadata writes from suppliers ====
-- =============================================================================
create or replace function internal.guard_product_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role and admin bypass this guard.
  if current_setting('role') = 'supabase_admin' then
    return new;
  end if;
  if internal.is_admin() then
    return new;
  end if;

  -- Suppliers may not touch approval metadata.
  if new.status is distinct from old.status then
    raise exception 'status can only be changed by an administrator';
  end if;
  if new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'reviewed_by can only be changed by an administrator';
  end if;
  if new.rejection_note is distinct from old.rejection_note then
    raise exception 'rejection_note can only be changed by an administrator';
  end if;
  if new.submitted_at is distinct from old.submitted_at then
    raise exception 'submitted_at can only be changed by an administrator';
  end if;

  -- supplier_id is immutable.
  if new.supplier_id is distinct from old.supplier_id then
    raise exception 'supplier_id cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_product_approval_fields on public.products;

create trigger guard_product_approval_fields
  before update on public.products
  for each row execute function internal.guard_product_approval_fields();

-- =============================================================================
-- 3. Audit triggers — record state changes =====================================
-- =============================================================================
create or replace function internal.audit_company_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kyb_status is distinct from old.kyb_status then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, old_status, new_status, meta)
    values (
      new.reviewed_by,
      'company',
      new.id,
      'kyb_status_change',
      old.kyb_status,
      new.kyb_status,
      jsonb_build_object(
        'old_rejection_note', old.rejection_note,
        'new_rejection_note', new.rejection_note
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_company_status_change on public.companies;

create trigger audit_company_status_change
  after update on public.companies
  for each row execute function internal.audit_company_status_change();

create or replace function internal.audit_product_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, old_status, new_status, meta)
    values (
      new.reviewed_by,
      'product',
      new.id,
      'status_change',
      old.status,
      new.status,
      jsonb_build_object(
        'old_rejection_note', old.rejection_note,
        'new_rejection_note', new.rejection_note
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_product_status_change on public.products;

create trigger audit_product_status_change
  after update on public.products
  for each row execute function internal.audit_product_status_change();

-- =============================================================================
-- 4. RPCs — the ONLY way to transition statuses =================================
-- =============================================================================

-- submit_kyb: supplier submits their KYB application (draft/pending/rejected → pending)
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
  update public.companies
  set kyb_status = 'pending',
      submitted_at = p_submitted_at,
      rejection_note = null
  where id = p_company_id;
end;
$$;

grant execute on function public.submit_kyb(uuid, timestamptz) to authenticated;

-- approve_kyb: admin approves a pending or rejected KYB application
create or replace function public.approve_kyb(
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not internal.is_admin() then
    raise exception 'Admin only';
  end if;
  if not exists (
    select 1 from public.companies
    where id = p_company_id and kyb_status in ('pending', 'rejected')
  ) then
    raise exception 'Company is not in an approvable state';
  end if;
  update public.companies
  set kyb_status = 'verified',
      verified_at = now(),
      reviewed_by = (select auth.uid()),
      rejection_note = null
  where id = p_company_id;
end;
$$;

grant execute on function public.approve_kyb(uuid) to authenticated;

-- reject_kyb: admin rejects a pending KYB application
create or replace function public.reject_kyb(
  p_company_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not internal.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_note is null or length(trim(p_note)) < 10 then
    raise exception 'Rejection note must be at least 10 characters';
  end if;
  if not exists (
    select 1 from public.companies
    where id = p_company_id and kyb_status = 'pending'
  ) then
    raise exception 'Company is not pending review';
  end if;
  update public.companies
  set kyb_status = 'rejected',
      reviewed_by = (select auth.uid()),
      rejection_note = p_note
  where id = p_company_id;
end;
$$;

grant execute on function public.reject_kyb(uuid, text) to authenticated;

-- submit_product_for_approval: supplier submits a product (draft/rejected → pending)
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
  if (select count(*) from public.product_images where product_id = p_product_id) < 3 then
    raise exception 'At least 3 images are required before submitting';
  end if;
  if not exists (
    select 1 from public.products
    where id = p_product_id and status in ('draft', 'rejected')
  ) then
    raise exception 'Product is not in a submittable state';
  end if;
  update public.products
  set status = 'pending',
      submitted_at = now(),
      rejection_note = null
  where id = p_product_id;
end;
$$;

grant execute on function public.submit_product_for_approval(uuid) to authenticated;

-- approve_product: admin approves a pending or rejected product
create or replace function public.approve_product(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not internal.is_admin() then
    raise exception 'Admin only';
  end if;
  if not exists (
    select 1 from public.products
    where id = p_product_id and status in ('pending', 'rejected')
  ) then
    raise exception 'Product is not in an approvable state';
  end if;
  update public.products
  set status = 'approved',
      rejection_note = null,
      reviewed_by = (select auth.uid())
  where id = p_product_id;
end;
$$;

grant execute on function public.approve_product(uuid) to authenticated;

-- reject_product: admin rejects a pending product
create or replace function public.reject_product(
  p_product_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not internal.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_note is null or length(trim(p_note)) < 10 then
    raise exception 'Rejection note must be at least 10 characters';
  end if;
  if not exists (
    select 1 from public.products
    where id = p_product_id and status = 'pending'
  ) then
    raise exception 'Product is not pending review';
  end if;
  update public.products
  set status = 'rejected',
      rejection_note = p_note,
      reviewed_by = (select auth.uid())
  where id = p_product_id;
end;
$$;

grant execute on function public.reject_product(uuid, text) to authenticated;
