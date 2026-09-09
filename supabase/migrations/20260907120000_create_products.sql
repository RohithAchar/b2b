-- Supplier product catalog (hybrid inquiry + checkout).
-- One product per supplier row; variants carry per-variant absolute price.
-- Evidence: .firecrawl/product-listing-comparison.md

create table public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null,
  description text not null,
  brand text,
  seller_sku text not null,
  hsn_code text not null,
  unit text not null default 'pcs'
    constraint products_unit_check check (unit in ('pcs', 'kg', 'box', 'mtr', 'ltr')),
  price_per_unit numeric(12, 2) not null constraint products_price_check check (price_per_unit > 0),
  moq integer not null constraint products_moq_check check (moq >= 1),
  stock_qty integer not null default 0 constraint products_stock_check check (stock_qty >= 0),
  price_slabs jsonb not null default '[]',
  negotiable boolean not null default false,
  sample_available boolean not null default false,
  sample_price numeric(12, 2),
  lead_time_days integer not null constraint products_lead_check check (lead_time_days between 1 and 90),
  gst_rate numeric(5, 2) constraint products_gst_check check (gst_rate in (0, 5, 12, 18, 28)),
  attributes jsonb not null default '{}',
  certifications text[] not null default '{}',
  packaging_details text,
  warranty_return text,
  youtube_url text,
  youtube_id text,
  status text not null default 'draft'
    constraint products_status_check check (status in ('draft', 'pending', 'approved', 'rejected')),
  rejection_note text,
  submitted_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_supplier_sku_unique unique (supplier_id, seller_sku)
);

create index products_supplier_idx on public.products (supplier_id);
create index products_category_idx on public.products (category_id);
create index products_status_idx on public.products (status);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  sort integer not null default 0 constraint product_images_sort_check check (sort >= 0),
  alt text,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null,
  attrs jsonb not null default '{}',
  seller_sku text not null,
  price numeric(12, 2) not null constraint product_variants_price_check check (price > 0),
  moq integer constraint product_variants_moq_check check (moq is null or moq >= 1),
  stock_qty integer not null default 0 constraint product_variants_stock_check check (stock_qty >= 0),
  image_index integer constraint product_variants_image_check check (image_index is null or image_index >= 0),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_variants_product_sku_unique unique (product_id, seller_sku)
);

create index product_variants_product_idx on public.product_variants (product_id);

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_images to authenticated;
grant select, insert, update, delete on public.product_variants to authenticated;
revoke all on public.products from anon;
revoke all on public.product_images from anon;
revoke all on public.product_variants from anon;
grant select on public.products to anon;
grant select on public.product_images to anon;

-- Public storefront reads: approved products + their images only.
create policy "products_select_approved"
  on public.products for select
  to anon, authenticated
  using (status = 'approved');

create policy "product_images_select_approved"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'approved'
    )
  );

-- Supplier own-row access via companies.owner_id.
create policy "products_supplier_all"
  on public.products for all
  to authenticated
  using (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

create policy "product_images_supplier_all"
  on public.product_images for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.companies c on c.id = p.supplier_id
      where p.id = product_images.product_id and c.owner_id = ((select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.products p
      join public.companies c on c.id = p.supplier_id
      where p.id = product_images.product_id and c.owner_id = ((select auth.uid()))
    )
  );

create policy "product_variants_supplier_all"
  on public.product_variants for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.companies c on c.id = p.supplier_id
      where p.id = product_variants.product_id and c.owner_id = ((select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.products p
      join public.companies c on c.id = p.supplier_id
      where p.id = product_variants.product_id and c.owner_id = ((select auth.uid()))
    )
  );

-- Admins manage everything.
create policy "products_admin_all"
  on public.products for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

create policy "product_images_admin_all"
  on public.product_images for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

create policy "product_variants_admin_all"
  on public.product_variants for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Public bucket for product images (storefront loads without auth).
insert into storage.buckets (id, name, public)
values ('product_images', 'product_images', true)
on conflict (id) do nothing;

create policy "product_images_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product_images');

create policy "product_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product_images'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create policy "product_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product_images'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  )
  with check (
    bucket_id = 'product_images'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create policy "product_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product_images'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );
