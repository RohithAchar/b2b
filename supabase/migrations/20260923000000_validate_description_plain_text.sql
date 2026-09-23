-- =============================================================================
-- Plain-text description length enforcement
-- =============================================================================
-- Descriptions are stored as sanitized rich-text HTML, so counting the raw
-- length lets a value like "<p>hi</p>" (25 characters) pass the 50-character
-- minimum even though it renders as a single word. The approval validator
-- now counts *visible* text: HTML tags are removed and HTML entities
-- collapsed before the length check, mirroring the client's plainTextLength()
-- helper.

-- Fold HTML down to approximate visible text.
create or replace function internal.description_text(p_html text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_html, ''), E'<[^>]+>', ' ', 'g'),
        E'&(?:[a-zA-Z]+|#[0-9]+);', ' ', 'g'
      ),
      E'\\s+', ' ', 'g'
    )
  );
$$;

-- =============================================================================
-- Canonical product validator (visible-text description check)
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
  if v_description is null or length(internal.description_text(v_description)) < 50 then
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