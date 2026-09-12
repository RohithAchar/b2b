-- Admin-managed front-page banners: hero carousel slides + a promo strip.
create table public.home_banners (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('hero','promo')),
  title text,
  subtitle text,
  link_url text,
  image_path text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.home_banners enable row level security;

-- Public storefront reads: active rows only, for everyone including anon.
-- (Revoke first: revoke-after-grant would wipe the anon read.)
revoke all on public.home_banners from anon;
grant select on public.home_banners to anon, authenticated;

create policy "home_banners_select_active"
  on public.home_banners for select
  to anon, authenticated
  using (is_active);

-- Admins manage everything. Write grants stay authenticated-only.
grant select, insert, update, delete on public.home_banners to authenticated;

create policy "home_banners_admin_all"
  on public.home_banners for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Public bucket for banner images (storefront loads without auth).
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

-- Public read; writes restricted to admins.
create policy "banners_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'banners');

create policy "banners_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'banners' and internal.is_admin());

create policy "banners_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'banners' and internal.is_admin())
  with check (bucket_id = 'banners' and internal.is_admin());

create policy "banners_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'banners' and internal.is_admin());