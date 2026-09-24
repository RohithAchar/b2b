-- Suppliers can edit live (approved) products in place; suppliers can hide
-- their own live products instantly; admins can take down any live product.
--
-- 1. products.is_hidden flag (supplier-controlled, instant hide/unhide).
-- 2. RLS: suppliers may update own draft/rejected/approved rows (content only;
--    approval metadata stays guard-trigger protected).
-- 3. Anon reads exclude hidden products (product + image + variant selects and
--    the storefront views).
-- 4. replace_product_variants / replace_product_images accept approved rows.
-- 5. unpublish_product RPC: admin-only approved -> draft (take down).

-- =============================================================================
-- 1. is_hidden flag -------------------------------------------------------------
-- =============================================================================
alter table public.products
  add column if not exists is_hidden boolean not null default false;

-- =============================================================================
-- 2. Supplier update policy: draft / rejected / approved ------------------------
-- =============================================================================
drop policy if exists "products_update_supplier_draft_or_rejected" on public.products;

create policy "products_update_supplier_editable"
  on public.products for update
  to authenticated
  using (
    status in ('draft', 'rejected', 'approved')
    and supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

-- =============================================================================
-- 3. Anon reads exclude hidden products ------------------------------------------
-- =============================================================================
drop policy if exists "products_select_approved" on public.products;

create policy "products_select_approved"
  on public.products for select
  to anon, authenticated
  using (status = 'approved' and is_hidden = false);

drop policy if exists "product_images_select_approved" on public.product_images;

create policy "product_images_select_approved"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.status = 'approved'
        and p.is_hidden = false
    )
  );

drop policy if exists "product_variants_select_approved" on public.product_variants;

create policy "product_variants_select_approved"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status = 'approved'
        and p.is_hidden = false
    )
  );

-- Storefront views: exclude hidden products from counts and featured imagery.
create or replace view public.supplier_featured_images as
select
  c.id as supplier_id,
  pi.path as image_path,
  pi.sort
from public.companies c
join public.products p on p.supplier_id = c.id and p.status = 'approved' and p.is_hidden = false
join public.product_images pi on pi.product_id = p.id
where c.kyb_status = 'verified'
  and p.created_at = (
    select max(p2.created_at)
    from public.products p2
    where p2.supplier_id = c.id
      and p2.status = 'approved'
      and p2.is_hidden = false
  )
order by c.id, pi.sort
limit 100;

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
  where p.status = 'approved' and p.is_hidden = false
  group by p.category_id
) approved_counts on approved_counts.category_id = cat.id
left join (
  select
    parent.id as parent_id,
    count(*) as sub_count
  from public.categories parent
  join public.categories sub on sub.parent_id = parent.id
  join public.products p on p.category_id = sub.id
    and p.status = 'approved'
    and p.is_hidden = false
  group by parent.id
) sub_counts on sub_counts.parent_id = cat.id
where cat.parent_id is null
group by cat.id, sub_counts.sub_count, approved_counts.count;

-- =============================================================================
-- 4. Child-table replacement RPCs accept approved --------------------------------
-- =============================================================================
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

  if not exists (
    select 1 from public.companies
    where id = v_supplier and owner_id = (select auth.uid()) and kyb_status = 'verified'
  ) then
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

-- =============================================================================
-- 5. unpublish_product: admin takes down a live product --------------------------
-- =============================================================================
create or replace function public.unpublish_product(
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
    where id = p_product_id and status = 'approved'
  ) then
    raise exception 'Product is not live';
  end if;

  perform set_config('app.internal_guard_bypass', 'on', true);
  update public.products
  set status = 'draft',
      rejection_note = null,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_product_id;
end;
$$;

grant execute on function public.unpublish_product(uuid) to authenticated;