-- Global product catalogue: shared product records across stores.
-- Supplier-owned products reference global_product_id to map into the shared
-- catalogue. Supplier-specific fields (price, stock, SKU, slabs, approval
-- status) stay on public.products; shared attributes live here.

create table public.global_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null,
  description text not null,
  brand text,
  hsn_code text not null,
  unit text not null default 'pcs'
    constraint global_products_unit_check
    check (unit in ('pcs', 'kg', 'box', 'mtr', 'ltr')),
  attributes jsonb not null default '{}',
  certifications text[] not null default '{}',
  packaging_details text,
  warranty_return text,
  youtube_url text,
  youtube_id text,
  seo_title text,
  seo_description text,
  seo_image_path text,
  status text not null default 'draft'
    constraint global_products_status_check
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  rejection_note text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index global_products_category_idx on public.global_products (category_id);
create index global_products_status_idx on public.global_products (status);

alter table public.global_products enable row level security;

-- New tables are NOT auto-exposed to the Data API. Grant explicitly, then
-- lock rows down with RLS below.
grant select on public.global_products to anon, authenticated;

-- Public read: approved global products are visible to the storefront.
create policy "global_products_select_approved"
  on public.global_products for select
  to anon, authenticated
  using (status = 'approved');

-- Admins manage all global products.
create policy "global_products_admin_all"
  on public.global_products for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Keep updated_at fresh on edits, mirroring the products/table pattern.
create trigger set_global_products_updated_at
  before update on public.global_products
  for each row execute function internal.set_updated_at();

-- Map supplier products to the global catalogue. Nullable so existing
-- products keep working while migration happens incrementally.
alter table public.products
  add column global_product_id uuid
    references public.global_products (id) on delete set null;

create index products_global_product_idx on public.products (global_product_id);

-- Shared images for global products.
create table public.global_product_images (
  id uuid primary key default gen_random_uuid(),
  global_product_id uuid not null references public.global_products (id) on delete cascade,
  path text not null,
  sort integer not null default 0
    constraint global_product_images_sort_check
    check (sort >= 0),
  alt text,
  created_at timestamptz not null default now()
);

create index global_product_images_global_product_idx
  on public.global_product_images (global_product_id);

alter table public.global_product_images enable row level security;

grant select on public.global_product_images to anon, authenticated;

-- Public read: images of approved global products only.
create policy "global_product_images_select_approved"
  on public.global_product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.global_products gp
      where gp.id = global_product_images.global_product_id
        and gp.status = 'approved'
    )
  );

-- Admins manage all global product images.
create policy "global_product_images_admin_all"
  on public.global_product_images for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());
