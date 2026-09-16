-- Security: restrictive per-operation policies + storage validation.
--
-- Drop the permissive FOR ALL supplier policies and replace with
-- status-aware per-operation policies. Tighten the insert policy.
-- Add a storage.objects trigger for file-type validation.

-- =============================================================================
-- 1. Product policies — drop permissive FOR ALL, add restrictive per-op ========
-- =============================================================================
-- Drop the old permissive supplier FOR ALL policies.
drop policy if exists "products_supplier_all" on public.products;
drop policy if exists "product_images_supplier_all" on public.product_images;
drop policy if exists "product_variants_supplier_all" on public.product_variants;

-- ---------------------------------------------------------------------------
-- Products: per-operation policies
-- ---------------------------------------------------------------------------

-- SELECT: supplier can read own products in ANY status (dashboard/edit views).
create policy "products_select_supplier_own"
  on public.products for select
  to authenticated
  using (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

-- INSERT: supplier can only insert own product in 'draft' status
create policy "products_insert_supplier_draft"
  on public.products for insert
  to authenticated
  with check (
    status = 'draft'
    and submitted_at is null
    and rejection_note is null
    and reviewed_by is null
    and supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

-- UPDATE: supplier can update own products in draft/rejected status
-- (content fields only; status/reviewed_by/rejection_note blocked by guard trigger)
create policy "products_update_supplier_draft_or_rejected"
  on public.products for update
  to authenticated
  using (
    status in ('draft', 'rejected')
    and supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

-- DELETE: supplier can delete own products in draft/rejected status
create policy "products_delete_supplier_draft_or_rejected"
  on public.products for delete
  to authenticated
  using (
    status in ('draft', 'rejected')
    and supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- Product images: per-operation policies
-- ---------------------------------------------------------------------------

-- SELECT: supplier can read own product images in ANY status (dashboard/edit).
create policy "product_images_select_supplier_own"
  on public.product_images for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.companies c on c.id = p.supplier_id
      where p.id = product_images.product_id and c.owner_id = ((select auth.uid()))
    )
  );

-- INSERT: own product, draft/rejected status
create policy "product_images_insert_supplier"
  on public.product_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.status in ('draft', 'rejected')
        and p.supplier_id in (
          select id from public.companies where owner_id = ((select auth.uid()))
        )
    )
  );

-- UPDATE: own product, draft/rejected status
create policy "product_images_update_supplier"
  on public.product_images for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.status in ('draft', 'rejected')
        and p.supplier_id in (
          select id from public.companies where owner_id = ((select auth.uid()))
        )
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.supplier_id in (
          select id from public.companies where owner_id = ((select auth.uid()))
        )
    )
  );

-- DELETE: own product, draft/rejected status
create policy "product_images_delete_supplier"
  on public.product_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.status in ('draft', 'rejected')
        and p.supplier_id in (
          select id from public.companies where owner_id = ((select auth.uid()))
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Product variants: per-operation policies
-- ---------------------------------------------------------------------------

-- SELECT: supplier can read own product variants in ANY status (dashboard/edit).
create policy "product_variants_select_supplier_own"
  on public.product_variants for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.companies c on c.id = p.supplier_id
      where p.id = product_variants.product_id and c.owner_id = ((select auth.uid()))
    )
  );

-- INSERT: own product, draft/rejected status
create policy "product_variants_insert_supplier"
  on public.product_variants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status in ('draft', 'rejected')
        and p.supplier_id in (
          select id from public.companies where owner_id = ((select auth.uid()))
        )
    )
  );

-- UPDATE: own product, draft/rejected status
create policy "product_variants_update_supplier"
  on public.product_variants for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status in ('draft', 'rejected')
        and p.supplier_id in (
          select id from public.companies where owner_id = ((select auth.uid()))
        )
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.supplier_id in (
          select id from public.companies where owner_id = ((select auth.uid()))
        )
    )
  );

-- DELETE: own product, draft/rejected status
create policy "product_variants_delete_supplier"
  on public.product_variants for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status in ('draft', 'rejected')
        and p.supplier_id in (
          select id from public.companies where owner_id = ((select auth.uid()))
        )
    )
  );

-- =============================================================================
-- 2. Companies insert policy — tighten to prevent self-approval ==============
-- =============================================================================
-- The current insert policy lets suppliers set ANY column, including
-- kyb_status='verified', reviewed_at, etc. Tighten to require draft state.
drop policy if exists "companies_insert_own" on public.companies;

create policy "companies_insert_own"
  on public.companies for insert
  to authenticated
  with check (
    ((select auth.uid())) = owner_id
    and kyb_status = 'draft'
    and submitted_at is null
    and verified_at is null
    and reviewed_by is null
    and rejection_note is null
  );

-- =============================================================================
-- 3. Storage validation trigger — enforce size + mimetype per bucket ===========
-- =============================================================================
create or replace function internal.validate_storage_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_size int := length(NEW.path);  -- path length as rough proxy; actual file size checked at upload time
  v_bucket text := NEW.bucket_id;
  v_mime text := NEW.mimetype;
begin
  -- company_docs bucket: max 10 MB, images + PDFs only
  if v_bucket = 'company_docs' then
    if NEW.metadata is not null and NEW.metadata->>'size' is not null then
      if (NEW.metadata->>'size')::bigint > 10 * 1024 * 1024 then
        raise exception 'File exceeds 10 MB limit for company documents';
      end if;
    end if;
    if v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
      raise exception 'Only JPEG, PNG, WEBP or PDF files are allowed for company documents';
    end if;
  end if;

  -- product_images bucket: max 5 MB, images only
  if v_bucket = 'product_images' then
    if NEW.metadata is not null and NEW.metadata->>'size' is not null then
      if (NEW.metadata->>'size')::bigint > 5 * 1024 * 1024 then
        raise exception 'File exceeds 5 MB limit for product images';
      end if;
    end if;
    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Only JPEG, PNG or WEBP images are allowed for product images';
    end if;
  end if;

  -- banners bucket: max 5 MB, images only
  if v_bucket = 'banners' then
    if NEW.metadata is not null and NEW.metadata->>'size' is not null then
      if (NEW.metadata->>'size')::bigint > 5 * 1024 * 1024 then
        raise exception 'File exceeds 5 MB limit for banners';
      end if;
    end if;
    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Only JPEG, PNG or WEBP images are allowed for banners';
    end if;
  end if;

  -- category_images bucket: max 5 MB, images only
  if v_bucket = 'category_images' then
    if NEW.metadata is not null and NEW.metadata->>'size' is not null then
      if (NEW.metadata->>'size')::bigint > 5 * 1024 * 1024 then
        raise exception 'File exceeds 5 MB limit for category images';
      end if;
    end if;
    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Only JPEG, PNG or WEBP images are allowed for category images';
    end if;
  end if;

  -- company_logos bucket: max 2 MB, images only
  if v_bucket = 'company_logos' then
    if NEW.metadata is not null and NEW.metadata->>'size' is not null then
      if (NEW.metadata->>'size')::bigint > 2 * 1024 * 1024 then
        raise exception 'File exceeds 2 MB limit for company logos';
      end if;
    end if;
    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Only JPEG, PNG or WEBP images are allowed for company logos';
    end if;
  end if;

  return NEW;
end;
$$;

-- Attach to storage.objects. This fires AFTER insert on the storage.objects table.
-- Note: the storage.objects table is owned by supabase_admin; the trigger must
-- be created by a superuser. If this migration runs as supabase_admin (normal
-- for `supabase db push`), it will work.
create trigger validate_storage_upload
  after insert on storage.objects
  for each row execute function internal.validate_storage_upload();
