-- Admin-managed 2-level catalog: categories (parent_id null) + subcategories.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  parent_id uuid references public.categories (id) on delete restrict,
  image_path text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_slug_sibling_unique
    unique nulls not distinct (parent_id, slug)
);

alter table public.categories enable row level security;

-- Public catalog reads: active rows only, for everyone including anon.
-- (Revoke first: revoke-after-grant would wipe the anon read.)
revoke all on public.categories from anon;
grant select on public.categories to anon, authenticated;

create policy "categories_select_active"
  on public.categories for select
  to anon, authenticated
  using (is_active);

-- Admins manage everything. Write grants stay authenticated-only.
grant select, insert, update, delete on public.categories to authenticated;

create policy "categories_admin_all"
  on public.categories for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Depth guard: a subcategory's parent must itself be top-level.
create or replace function internal.enforce_two_levels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grandparent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  select parent_id into grandparent
    from public.categories where id = new.parent_id;
  if grandparent is not null then
    raise exception 'subcategories cannot have children';
  end if;
  if new.parent_id = new.id then
    raise exception 'category cannot be its own parent';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_two_levels on public.categories;

create trigger enforce_two_levels
  before insert or update on public.categories
  for each row execute function internal.enforce_two_levels();

-- Public bucket for catalog images (storefront loads without auth).
insert into storage.buckets (id, name, public)
values ('category_images', 'category_images', true)
on conflict (id) do nothing;

-- Public read; writes restricted to admins.
create policy "category_images_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'category_images');

create policy "category_images_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'category_images' and internal.is_admin());

create policy "category_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'category_images' and internal.is_admin())
  with check (bucket_id = 'category_images' and internal.is_admin());

create policy "category_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'category_images' and internal.is_admin());
