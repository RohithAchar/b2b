-- Optional company logo (nullable so existing suppliers are unaffected).
alter table public.companies
  add column logo_path text;

-- Public bucket: logos display on storefronts and dashboards without auth.
insert into storage.buckets (id, name, public)
values ('company_logos', 'company_logos', true)
on conflict (id) do nothing;

-- Public read; writes restricted to the owning user by folder namespace.
create policy "company_logos_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'company_logos');

create policy "company_logos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company_logos'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create policy "company_logos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'company_logos'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  )
  with check (
    bucket_id = 'company_logos'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create policy "company_logos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'company_logos'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create policy "company_logos_admin_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'company_logos' and internal.is_admin());
