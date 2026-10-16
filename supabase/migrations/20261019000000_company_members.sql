-- Supplier staff access: the owning user can grant one flat "staff" role to
-- another person (by email), giving them full dashboard access except the
-- owner-only areas (business profile, verification/KYB, margin, team).
--
-- Design notes:
-- - Membership is keyed by user_id (resolved from the email at invite time
--   via internal.staff_candidate), so auth-email changes never break access.
-- - internal.* helpers follow the established internal.is_admin() pattern:
--   read-only, SECURITY DEFINER with fixed search_path, living outside the
--   Data API schemas, always gating on auth.uid() in the body.
-- - Existing owner policies are untouched; staff access is purely additive
--   (*_staff policies). Owner-only writes (companies row, KYB) stay blocked
--   for staff because no staff UPDATE/INSERT/DELETE policy exists there.
-- - submit_kyb stays owner-only on purpose (verification is an owner area).
--   submit_product_for_approval / replace_product_* accept staff via
--   internal.can_manage_company(); status guards inside are unchanged.

-- =============================================================================
-- 1. Membership table ----------------------------------------------------------
-- =============================================================================
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Email snapshot for the owner-facing Team list. Owners cannot read other
  -- users' profiles rows through RLS, so the address is denormalized here at
  -- invite time. Access is always keyed by user_id, never by this column.
  email text not null,
  role text not null default 'staff'
    constraint company_members_role_check check (role in ('staff')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint company_members_company_user_unique unique (company_id, user_id)
);

create index company_members_user_idx on public.company_members (user_id);
create index company_members_company_idx on public.company_members (company_id);

alter table public.company_members enable row level security;

grant select, insert, update, delete on public.company_members to authenticated;
revoke all on public.company_members from anon;

-- Policies live in section 2b below: they call internal.is_company_owner(),
-- which must exist before CREATE POLICY validates their expressions.

-- =============================================================================
-- 2. Membership helpers ---------------------------------------------------------
-- =============================================================================
create or replace function internal.is_company_owner(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies
    where id = p_company_id and owner_id = (select auth.uid())
  )
$$;

grant execute on function internal.is_company_owner(uuid) to authenticated;

create or replace function internal.is_company_staff(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = (select auth.uid())
  )
$$;

grant execute on function internal.is_company_staff(uuid) to authenticated;

create or replace function internal.can_manage_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select internal.is_company_owner(p_company_id)
      or internal.is_company_staff(p_company_id)
$$;

grant execute on function internal.can_manage_company(uuid) to authenticated;

-- Invite-time lookup: the owner passes their company id + the staffer's
-- email and gets back the account to link. The owner check inside is the
-- authorization (callers cannot enumerate arbitrary profiles: without
-- owning p_company_id the call raises before any profile row is read).
create or replace function internal.staff_candidate(p_company_id uuid, p_email text)
returns table (user_id uuid, user_type text, owns_company_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not internal.is_company_owner(p_company_id) then
    raise exception 'Not your company';
  end if;
  return query
    select p.id, p.user_type, c.id
    from public.profiles p
    left join public.companies c on c.owner_id = p.id
    where p.email is not null and lower(p.email) = lower(btrim(p_email));
end;
$$;

grant execute on function internal.staff_candidate(uuid, text) to authenticated;

-- Staff can read their own membership rows (needed to resolve "my company").
-- Owners can list their company's members (Team UI). No UPDATE policy on
-- purpose: the role is immutable through the Data API.
create policy "company_members_select"
  on public.company_members for select
  to authenticated
  using (
    user_id = ((select auth.uid()))
    or internal.is_company_owner(company_id)
  );

create policy "company_members_insert_owner"
  on public.company_members for insert
  to authenticated
  with check (internal.is_company_owner(company_id));

create policy "company_members_delete_owner"
  on public.company_members for delete
  to authenticated
  using (internal.is_company_owner(company_id));

-- =============================================================================
-- 3. Companies: staff read ------------------------------------------------------
-- =============================================================================
-- Staff need the company row (dashboard layout reads business_name /
-- kyb_status; pricing reads margin_pct). No staff write policies: the
-- owner-only update policy stays the single writer, so business profile,
-- margin and KYB columns remain owner-only at the database level too.
create policy "companies_select_staff"
  on public.companies for select
  to authenticated
  using (internal.is_company_staff(id));

-- =============================================================================
-- 4. Products / images / variants: staff mirrors ---------------------------------
-- =============================================================================
create policy "products_select_staff"
  on public.products for select
  to authenticated
  using (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  );

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
  );

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
  );

create policy "products_delete_staff_draft_or_rejected"
  on public.products for delete
  to authenticated
  using (
    status in ('draft', 'rejected')
    and supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  );

create policy "product_images_select_staff"
  on public.product_images for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_images.product_id and m.user_id = ((select auth.uid()))
    )
  );

create policy "product_images_insert_staff"
  on public.product_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_images.product_id
        and p.status in ('draft', 'rejected')
        and m.user_id = ((select auth.uid()))
    )
  );

create policy "product_images_update_staff"
  on public.product_images for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_images.product_id
        and p.status in ('draft', 'rejected')
        and m.user_id = ((select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_images.product_id
        and m.user_id = ((select auth.uid()))
    )
  );

create policy "product_images_delete_staff"
  on public.product_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_images.product_id
        and p.status in ('draft', 'rejected')
        and m.user_id = ((select auth.uid()))
    )
  );

create policy "product_variants_select_staff"
  on public.product_variants for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_variants.product_id and m.user_id = ((select auth.uid()))
    )
  );

create policy "product_variants_insert_staff"
  on public.product_variants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_variants.product_id
        and p.status in ('draft', 'rejected')
        and m.user_id = ((select auth.uid()))
    )
  );

create policy "product_variants_update_staff"
  on public.product_variants for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_variants.product_id
        and p.status in ('draft', 'rejected')
        and m.user_id = ((select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_variants.product_id
        and m.user_id = ((select auth.uid()))
    )
  );

create policy "product_variants_delete_staff"
  on public.product_variants for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.company_members m on m.company_id = p.supplier_id
      where p.id = product_variants.product_id
        and p.status in ('draft', 'rejected')
        and m.user_id = ((select auth.uid()))
    )
  );

-- =============================================================================
-- 5. Orders / events / coupons / customers: staff mirrors -------------------------
-- =============================================================================
create policy "orders_staff_all"
  on public.orders for all
  to authenticated
  using (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  );

create policy "order_items_staff_all"
  on public.order_items for all
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.company_members m on m.company_id = o.supplier_id
      where o.id = order_items.order_id and m.user_id = ((select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      join public.company_members m on m.company_id = o.supplier_id
      where o.id = order_items.order_id and m.user_id = ((select auth.uid()))
    )
  );

create policy "storefront_events_staff_select"
  on public.storefront_events for select
  to authenticated
  using (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  );

create policy "coupons_staff_all"
  on public.coupons for all
  to authenticated
  using (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  );

create policy "store_customers_staff_all"
  on public.store_customers for all
  to authenticated
  using (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select company_id from public.company_members
      where user_id = ((select auth.uid()))
    )
  );

-- =============================================================================
-- 6. Storage: staff can manage product images in the owner's folder --------------
-- =============================================================================
-- Uploads land in <uploader-uid>/… folders, so staff inserts already work via
-- the *_own policies. Edits replace/remove the owner's files, which needs
-- these staff counterparts (scoped to companies the caller staffs).
create policy "product_images_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product_images'
    and exists (
      select 1 from public.companies c
      join public.company_members m on m.company_id = c.id
      where c.owner_id = ((storage.foldername(name))[1])::uuid
        and m.user_id = ((select auth.uid()))
    )
  )
  with check (
    bucket_id = 'product_images'
    and exists (
      select 1 from public.companies c
      join public.company_members m on m.company_id = c.id
      where c.owner_id = ((storage.foldername(name))[1])::uuid
        and m.user_id = ((select auth.uid()))
    )
  );

create policy "product_images_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product_images'
    and exists (
      select 1 from public.companies c
      join public.company_members m on m.company_id = c.id
      where c.owner_id = ((storage.foldername(name))[1])::uuid
        and m.user_id = ((select auth.uid()))
    )
  );

-- =============================================================================
-- 7. supplier_prices view: staff see their company's base prices ------------------
-- =============================================================================
-- Views bypass RLS, so the predicate below is the access boundary. Same shape
-- as the original, plus the staffed-company branch. Base prices stay private:
-- only the owning or staffing supplier (and admins) can read them.
create or replace view public.supplier_prices as
select
  p.id as product_id,
  p.supplier_id,
  p.price_per_unit,
  p.price_slabs,
  p.sample_price,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('id', v.id, 'label', v.label, 'price', v.price)
      order by v.sort, v.id
    )
    from public.product_variants v
    where v.product_id = p.id
  ), '[]'::jsonb) as variants
from public.products p
where p.supplier_id in (
    select c.id from public.companies c where c.owner_id = (select auth.uid())
  )
  or p.supplier_id in (
    select m.company_id from public.company_members m
    where m.user_id = (select auth.uid())
  )
  or internal.is_admin();

-- =============================================================================
-- 8. Lifecycle RPCs: accept staff via can_manage_company ---------------------------
-- =============================================================================
-- submit_kyb is intentionally untouched (verification stays owner-only).
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
  set status = 'pending',
      submitted_at = now(),
      rejection_note = null,
      reviewed_by = null,
      reviewed_at = null
  where id = p_product_id;
end;
$$;

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
