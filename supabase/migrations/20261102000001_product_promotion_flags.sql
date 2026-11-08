alter table public.products
  add column if not exists is_winning boolean not null default false,
  add column if not exists is_hot_selling boolean not null default false;