-- Supplier companies + KYB (one row per user; see profiles.user_type).
-- Approval is manual in the dashboard: set kyb_status + optional rejection_note.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  business_name text not null,
  contact_person text not null,
  phone text not null,
  address text not null,
  city text not null,
  state text not null,
  pincode text not null,
  gstin text not null,
  pan text not null,
  bank_account text not null,
  bank_ifsc text not null,
  gst_certificate_path text,
  pan_card_path text,
  license_path text,
  kyb_status text not null default 'draft'
    constraint companies_kyb_status_check
    check (kyb_status in ('draft', 'pending', 'verified', 'rejected')),
  rejection_note text,
  submitted_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

-- Explicit Data API grants (new tables are not auto-exposed).
grant select, insert, update, delete on public.companies to authenticated;
revoke all on public.companies from anon;

-- Owner-only access. No public read: there is no storefront yet.
create policy "companies_select_own"
  on public.companies for select
  to authenticated
  using (((select auth.uid())) = owner_id);

create policy "companies_insert_own"
  on public.companies for insert
  to authenticated
  with check (((select auth.uid())) = owner_id);

create policy "companies_update_own"
  on public.companies for update
  to authenticated
  using (((select auth.uid())) = owner_id)
  with check (((select auth.uid())) = owner_id);

create policy "companies_delete_own"
  on public.companies for delete
  to authenticated
  using (((select auth.uid())) = owner_id);

-- Private bucket for KYB documents, namespaced <owner_id>/<file>.
insert into storage.buckets (id, name, public)
values ('company_docs', 'company_docs', false)
on conflict (id) do nothing;

create policy "company_docs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company_docs'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create policy "company_docs_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'company_docs'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create policy "company_docs_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'company_docs'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  )
  with check (
    bucket_id = 'company_docs'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create policy "company_docs_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'company_docs'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );
