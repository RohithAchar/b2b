-- Simplify supplier onboarding: automatic activation, no manual KYB approval.
-- Suppliers are internal; remove verification gating from product management.

-- 1. Optional tax/bank fields.
alter table public.companies
  alter column gstin drop not null,
  alter column pan drop not null,
  alter column bank_account drop not null,
  alter column bank_ifsc drop not null;

-- 2. Migrate existing pending/rejected/draft companies to verified so no
--    supplier is locked out by the old workflow.
update public.companies
set kyb_status = 'verified',
    verified_at = coalesce(verified_at, now()),
    rejection_note = null
where kyb_status in ('draft', 'pending', 'rejected');

-- 3. Company guard: keep owner-only writes; kyb metadata only via RPC/bypass.
-- (existing trigger already blocks direct writes; recreate to be safe)
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

  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;

  return new;
end;
$$;

-- 4. Product validator: remove supplier verification requirement.
create or replace function internal.validate_product_for_approval(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier uuid;
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

  select count(*) into v_cat_count
    from public.categories c
    where c.id = v_category and c.is_active;
  if v_cat_count = 0 then
    raise exception 'Category is not active';
  end if;

  select count(*) into v_image_count
    from public.product_images
    where product_id = p_product_id;
  if v_image_count < 3 then
    raise exception 'At least 3 images are required before submitting';
  end if;
  if v_image_count > 8 then
    raise exception 'At most 8 images are allowed';
  end if;

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

-- 5. submit_kyb: auto-activate supplier account.
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

grant execute on function public.submit_kyb(uuid, timestamptz) to authenticated;

-- 6. submit_product_for_approval: auto-publish after validation.
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
  if not internal.can_manage_company(v_supplier) then
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

grant execute on function public.submit_product_for_approval(uuid) to authenticated;

-- 7. Remove KYB gating from variant/image RPCs.
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

  if not internal.can_manage_company(v_supplier) then
    raise exception 'Not your product';
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and status in ('draft', 'rejected', 'approved')
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

  delete from public.product_variants where product_id = p_product_id;
  insert into public.product_variants (product_id, label, attrs, seller_sku, price, moq, stock_qty, sort)
  select p_product_id, label, attrs, sku, price, moq, stock_qty, sort
    from tmp_var_rows
    order by sort;
end;
$$;

grant execute on function public.replace_product_variants(uuid, jsonb) to authenticated;

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

  if not internal.can_manage_company(v_supplier) then
    raise exception 'Not your product';
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and status in ('draft', 'rejected', 'approved')
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
