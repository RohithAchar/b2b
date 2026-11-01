-- Approved products were not editable: replace_product_images and
-- replace_product_variants only accepted draft/rejected rows, so saving an
-- approved product failed after the product row update had already been
-- applied. Approved listings stay editable (price, stock, packaging, media).

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
    select 1 from public.companies
    where id = v_supplier and kyb_status = 'verified'
  ) then
    raise exception 'Company is not verified';
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

  -- Atomic replacement.
  delete from public.product_variants where product_id = p_product_id;
  insert into public.product_variants (product_id, label, attrs, seller_sku, price, moq, stock_qty, sort)
  select p_product_id, label, attrs, sku, price, moq, stock_qty, sort
    from tmp_var_rows
    order by sort;
end;
$$;

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
    select 1 from public.companies
    where id = v_supplier and kyb_status = 'verified'
  ) then
    raise exception 'Company is not verified';
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
