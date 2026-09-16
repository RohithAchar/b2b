-- Security hardening for the product lifecycle.
--
-- 1. State machine fixes
--    * approve_product only accepts status = 'pending'. A rejected product is
--      no longer directly approvable; the supplier must resubmit it first.
--    * approve_kyb aligned with the same principle (pending only).
-- 2. Defensive approval
--    * Both submit_product_for_approval and approve_product run the canonical
--      validator internal.validate_product_for_approval(), so a structurally
--      incomplete or ineligible product can never reach pending or approved,
--      even when the RPC is called directly outside the UI.
-- 3. Audit logging
--    * Audit triggers record the real actor via auth.uid() instead of the
--      transient reviewed_by (which is NULL on supplier submissions and stale
--      on resubmission).
-- 4. Reviewed metadata
--    * products.reviewed_at tracks when the last decision was made; cleared on
--      resubmission. Guarded so suppliers cannot write it.
-- 5. Atomic mutation
--    * replace_product_variants / replace_product_images replace the JS-side
--      diff loops with transactional DELETE+INSERT replacements that re-verify
--      ownership, editable state, eligibility, canonical field rules and
--      supplier-wide SKU uniqueness.
-- 6. Guard bypass
--    * The state-machine RPCs are SECURITY DEFINER and mutate parent tables
--      through the approval-field guard triggers. A transaction-local flag
--      (app.internal_guard_bypass) set inside those RPCs lets the sanitized
--      path through while direct client UPDATEs remain blocked. The flag is
--      not settable from the Data API.

-- =============================================================================
-- 1. products.reviewed_at -----------------------------------------------------
-- =============================================================================
alter table public.products
  add column if not exists reviewed_at timestamptz;

-- =============================================================================
-- 2. Guard triggers — honor the RPC bypass flag; block supplier written
--    reviewed_at; keep all previously guarded columns. ------------------------
-- =============================================================================
create or replace function internal.guard_product_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sanitized state-machine path (see section 6) and service/migration role.
  if current_setting('app.internal_guard_bypass', true) = 'on' then
    return new;
  end if;
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
  if new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'reviewed_at can only be changed by an administrator';
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

create or replace function internal.guard_company_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.internal_guard_bypass', true) = 'on' then
    return new;
  end if;
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

-- =============================================================================
-- 3. Audit triggers — record the real actor -----------------------------------
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
      (select auth.uid()),
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
      (select auth.uid()),
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

-- =============================================================================
-- 4. updated_at maintenance ---------------------------------------------------
-- =============================================================================
create or replace function internal.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;

create trigger set_products_updated_at
  before update on public.products
  for each row execute function internal.set_updated_at();

-- =============================================================================
-- 5. Canonical product validator ---------------------------------------------
-- =============================================================================
create or replace function internal.validate_product_for_approval(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier uuid;
  v_company_status text;
  v_title text;
  v_description text;
  v_sku text;
  v_hsn text;
  v_unit text;
  v_price numeric;
  v_moq integer;
  v_stock integer;
  v_lead integer;
  v_gst numeric;
  v_category uuid;
  v_cat_count bigint;
  v_image_count bigint;
  v_count bigint;
  v_variant record;
  v_prev_sku text := null;
  v_collision uuid;
begin
  select supplier_id into v_supplier from public.products where id = p_product_id;
  if v_supplier is null then
    raise exception 'Product not found';
  end if;

  select c.kyb_status into v_company_status
    from public.companies c
    where c.id = v_supplier;
  if v_company_status is null then
    raise exception 'Supplier company not found';
  end if;
  if v_company_status <> 'verified' then
    raise exception 'Supplier is not verified';
  end if;

  select p.title, p.description, p.seller_sku, p.hsn_code, p.unit,
         p.price_per_unit, p.moq, p.stock_qty, p.lead_time_days, p.gst_rate,
         p.category_id
    into v_title, v_description, v_sku, v_hsn, v_unit,
         v_price, v_moq, v_stock, v_lead, v_gst,
         v_category
    from public.products p
    where p.id = p_product_id;

  if v_title is null or length(btrim(v_title)) < 10 then
    raise exception 'Product title must be at least 10 characters';
  end if;
  if v_description is null or length(btrim(v_description)) < 50 then
    raise exception 'Product description must be at least 50 characters';
  end if;
  if v_hsn is null or v_hsn !~ '^[0-9]{4,8}$' then
    raise exception 'HSN code must be 4-8 digits';
  end if;
  if v_unit is null or v_unit not in ('pcs', 'kg', 'box', 'mtr', 'ltr') then
    raise exception 'Invalid unit';
  end if;
  if v_price is null or v_price <= 0 then
    raise exception 'Price must be greater than 0';
  end if;
  if v_moq is null or v_moq < 1 then
    raise exception 'MOQ must be at least 1';
  end if;
  if v_stock is null or v_stock < 0 then
    raise exception 'Stock cannot be negative';
  end if;
  if v_lead is null or (v_lead < 1 or v_lead > 90) then
    raise exception 'Lead time must be between 1 and 90 days';
  end if;
  if v_gst is null or v_gst not in (0, 5, 12, 18, 28) then
    raise exception 'Invalid GST rate';
  end if;

  -- Category must be active.
  select count(*) into v_cat_count
    from public.categories c
    where c.id = v_category and c.is_active;
  if v_cat_count = 0 then
    raise exception 'Category is not active';
  end if;

  -- Image count (canonical: 3..8).
  select count(*) into v_image_count
    from public.product_images
    where product_id = p_product_id;
  if v_image_count < 3 then
    raise exception 'At least 3 images are required before submitting';
  end if;
  if v_image_count > 8 then
    raise exception 'At most 8 images are allowed';
  end if;

  -- Variant count ceiling.
  select count(*) into v_count
    from public.product_variants
    where product_id = p_product_id;
  if v_count > 20 then
    raise exception 'At most 20 variants are allowed';
  end if;

  for v_variant in
    select pv.seller_sku, pv.label, pv.price, pv.moq, pv.stock_qty
      from public.product_variants pv
      where pv.product_id = p_product_id
      order by pv.sort
  loop
    if v_variant.label is null or length(btrim(v_variant.label)) < 2 then
      raise exception 'Each variant needs a label of at least 2 characters';
    end if;
    if v_variant.seller_sku !~ '^[A-Z0-9_-]{3,30}$' then
      raise exception 'Variant SKU %L must be 3-30 chars using letters, numbers, - or _', v_variant.seller_sku;
    end if;
    if v_variant.seller_sku = v_sku then
      raise exception 'Variant SKU %L matches the product SKU', v_variant.seller_sku;
    end if;
    if v_variant.price is null or v_variant.price <= 0 then
      raise exception 'Variant price must be greater than 0';
    end if;
    if v_variant.moq is not null and v_variant.moq < 1 then
      raise exception 'Variant MOQ must be at least 1 when set';
    end if;
    if v_variant.stock_qty is null or v_variant.stock_qty < 0 then
      raise exception 'Variant stock cannot be negative';
    end if;
    if v_prev_sku is not null and v_variant.seller_sku = v_prev_sku then
      raise exception 'Duplicate variant SKU %L', v_variant.seller_sku;
    end if;
    v_prev_sku := v_variant.seller_sku;

    -- Supplier-wide: variant SKU must not collide with another product of the
    -- same supplier (its SKU or any of its variant SKUs).
    select 1 into v_collision
      from public.products p
      where p.supplier_id = v_supplier
        and p.id <> p_product_id
        and (
          p.seller_sku = v_variant.seller_sku
          or exists (
            select 1 from public.product_variants pv2
            where pv2.product_id = p.id and pv2.seller_sku = v_variant.seller_sku
          )
        )
      limit 1;
    if v_collision is not null then
      raise exception 'SKU %L is already used by another of your products', v_variant.seller_sku;
    end if;
  end loop;

  -- Supplier-wide: the product SKU must not collide with another product's
  -- variant SKU. (Product-vs-product SKU is already a DB unique constraint.)
  select 1 into v_collision
    from public.product_variants pv3
    join public.products p3 on p3.id = pv3.product_id
    where p3.supplier_id = v_supplier
      and p3.id <> p_product_id
      and pv3.seller_sku = v_sku
    limit 1;
  if v_collision is not null then
    raise exception 'SKU %L is already used by one of your variants', v_sku;
  end if;
end;
$$;

-- =============================================================================
-- 6. State-machine RPCs --------------------------------------------------------
-- =============================================================================

-- submit_product_for_approval: supplier submits a draft or rejected product.
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
  set status = 'pending',
      submitted_at = now(),
      rejection_note = null,
      reviewed_by = null,
      reviewed_at = null
  where id = p_product_id;
end;
$$;

-- approve_product: admin approves a product that is pending review.
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
    where id = p_product_id and status = 'pending'
  ) then
    raise exception 'Product is not pending review';
  end if;

  perform internal.validate_product_for_approval(p_product_id);

  perform set_config('app.internal_guard_bypass', 'on', true);
  update public.products
  set status = 'approved',
      rejection_note = null,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_product_id;
end;
$$;

-- reject_product: admin sends a pending product back with a note.
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

  perform set_config('app.internal_guard_bypass', 'on', true);
  update public.products
  set status = 'rejected',
      rejection_note = p_note,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_product_id;
end;
$$;

-- submit_kyb: supplier submits a draft or rejected KYB application.
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
  set kyb_status = 'pending',
      submitted_at = p_submitted_at,
      rejection_note = null
  where id = p_company_id;
end;
$$;

-- approve_kyb: admin approves a pending KYB application.
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
    where id = p_company_id and kyb_status = 'pending'
  ) then
    raise exception 'Company is not pending review';
  end if;

  perform set_config('app.internal_guard_bypass', 'on', true);
  update public.companies
  set kyb_status = 'verified',
      verified_at = now(),
      reviewed_by = (select auth.uid()),
      rejection_note = null
  where id = p_company_id;
end;
$$;

-- reject_kyb: admin rejects a pending KYB application.
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

  perform set_config('app.internal_guard_bypass', 'on', true);
  update public.companies
  set kyb_status = 'rejected',
      reviewed_by = (select auth.uid()),
      rejection_note = p_note
  where id = p_company_id;
end;
$$;

-- =============================================================================
-- 7. Atomic child-table mutation ----------------------------------------------
-- =============================================================================

-- replace_product_variants: transactional full replacement of a product's
-- variants. Validates ownership, editable state, eligibility, each variant,
-- intra-payload duplicates and supplier-wide SKU collisions.
create or replace function public.replace_product_variants(
  p_product_id uuid,
  p_variants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier uuid;
  v_product_sku text;
  v_item jsonb;
  v_idx int := 0;
  v_label text;
  v_attrs jsonb;
  v_sku text;
  v_price numeric;
  v_moq numeric;
  v_stock int;
begin
  select supplier_id into v_supplier from public.products where id = p_product_id;
  if v_supplier is null then
    raise exception 'Product not found';
  end if;

  if not exists (
    select 1 from public.companies
    where id = v_supplier and owner_id = (select auth.uid()) and kyb_status = 'verified'
  ) then
    raise exception 'Not your product';
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and status in ('draft', 'rejected')
  ) then
    raise exception 'Product is not editable in its current state';
  end if;

  select seller_sku into v_product_sku from public.products where id = p_product_id;

  if p_variants is not null and jsonb_typeof(p_variants) <> 'array' then
    raise exception 'Variants must be an array';
  end if;

  create temp table tmp_var_rows (
    sort int primary key,
    label text not null,
    attrs jsonb not null default '{}',
    sku text not null,
    price numeric not null,
    moq numeric,
    stock_qty int not null default 0
  ) on commit drop;

  for v_item in
    select jsonb_array_elements(coalesce(p_variants, '[]'::jsonb))
  loop
    v_idx := v_idx + 1;
    if v_idx > 20 then
      raise exception 'At most 20 variants are allowed';
    end if;

    v_label := v_item->>'label';
    v_attrs := coalesce(v_item->'attrs', '{}'::jsonb);
    v_sku := upper(coalesce(v_item->>'seller_sku', ''));
    v_price := (v_item->>'price')::numeric;
    v_moq := nullif(v_item->>'moq', '')::numeric;
    v_stock := coalesce((v_item->>'stock_qty')::int, 0);

    if v_label is null or length(btrim(v_label)) < 2 then
      raise exception 'Variant %s: label is required', v_idx;
    end if;
    if v_sku !~ '^[A-Z0-9_-]{3,30}$' then
      raise exception 'Variant %s: SKU must be 3-30 chars (letters, numbers, - or _)', v_idx;
    end if;
    if v_price is null or v_price <= 0 then
      raise exception 'Variant %s: price must be greater than 0', v_idx;
    end if;
    if v_moq is not null and v_moq < 1 then
      raise exception 'Variant %s: MOQ must be at least 1 when set', v_idx;
    end if;
    if v_stock < 0 then
      raise exception 'Variant %s: stock cannot be negative', v_idx;
    end if;
    if v_sku = v_product_sku then
      raise exception 'Variant %s: SKU matches the product SKU', v_idx;
    end if;
    if exists (
      select 1 from tmp_var_rows where sku = v_sku
    ) then
      raise exception 'Variant %s: duplicate SKU %L', v_idx, v_sku;
    end if;
    if exists (
      select 1 from public.products p
      where p.supplier_id = v_supplier
        and p.id <> p_product_id
        and (
          p.seller_sku = v_sku
          or exists (
            select 1 from public.product_variants pv
            where pv.product_id = p.id and pv.seller_sku = v_sku
          )
        )
    ) then
      raise exception 'Variant %s: SKU %L is already used by another of your products', v_idx, v_sku;
    end if;

    insert into tmp_var_rows (sort, label, attrs, sku, price, moq, stock_qty)
    values (v_idx, v_label, v_attrs, v_sku, v_price, v_moq, v_stock);
  end loop;

  -- Atomic replacement.
  delete from public.product_variants where product_id = p_product_id;
  insert into public.product_variants (product_id, label, attrs, seller_sku, price, moq, stock_qty, sort)
  select p_product_id, label, attrs, sku, price, moq, stock_qty, sort
    from tmp_var_rows
    order by sort;
end;
$$;

grant execute on function public.replace_product_variants(uuid, jsonb) to authenticated;

-- replace_product_images: transactional full replacement of a product's image
-- rows. Storage uploads happen in the app; this RPC owns the DB rows only.
create or replace function public.replace_product_images(
  p_product_id uuid,
  p_paths text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier uuid;
  v_path text;
  v_idx int := 0;
begin
  select supplier_id into v_supplier from public.products where id = p_product_id;
  if v_supplier is null then
    raise exception 'Product not found';
  end if;

  if not exists (
    select 1 from public.companies
    where id = v_supplier and owner_id = (select auth.uid()) and kyb_status = 'verified'
  ) then
    raise exception 'Not your product';
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and status in ('draft', 'rejected')
  ) then
    raise exception 'Product is not editable in its current state';
  end if;

  if p_paths is not null and array_length(p_paths, 1) > 8 then
    raise exception 'Products can have up to 8 images';
  end if;

  foreach v_path in array coalesce(p_paths, ARRAY[]::text[])
  loop
    if v_path is null or btrim(v_path) = '' then
      raise exception 'Image path cannot be empty';
    end if;
  end loop;

  delete from public.product_images where product_id = p_product_id;
  foreach v_path in array coalesce(p_paths, ARRAY[]::text[])
  loop
    insert into public.product_images (product_id, path, sort)
    values (p_product_id, v_path, v_idx);
    v_idx := v_idx + 1;
  end loop;
end;
$$;

grant execute on function public.replace_product_images(uuid, text[]) to authenticated;