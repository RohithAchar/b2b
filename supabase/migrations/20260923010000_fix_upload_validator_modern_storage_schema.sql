-- =============================================================================
-- Fix storage validation trigger for the modern storage.objects schema.
--
-- Newer Supabase Storage versions no longer expose `mimetype` / `path` columns
-- on storage.objects: the mimetype is stored inside `metadata->>'mimetype'`.
-- The previous validator referenced NEW.path and NEW.mimetype, which no longer
-- exist, so the AFTER INSERT trigger raised an error on every upload to every
-- bucket. This migration drops that broken trigger and recreates the function
-- reading mimetype from metadata, and only enforcing type rules when a mimetype
-- was actually recorded (the client already validates via magic-byte sniffing).
-- =============================================================================

drop trigger if exists validate_storage_upload on storage.objects;

create or replace function internal.validate_storage_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text := NEW.bucket_id;
  v_mime text := NEW.metadata->>'mimetype';
begin
  -- company_docs bucket: max 10 MB, images + PDFs only
  if v_bucket = 'company_docs' then
    if NEW.metadata is not null and NEW.metadata->>'size' is not null then
      if (NEW.metadata->>'size')::bigint > 10 * 1024 * 1024 then
        raise exception 'File exceeds 10 MB limit for company documents';
      end if;
    end if;
    if v_mime is not null and v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
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
    if v_mime is not null and v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
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
    if v_mime is not null and v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
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
    if v_mime is not null and v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
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
    if v_mime is not null and v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Only JPEG, PNG or WEBP images are allowed for company logos';
    end if;
  end if;

  return NEW;
end;
$$;

create trigger validate_storage_upload
  after insert on storage.objects
  for each row execute function internal.validate_storage_upload();