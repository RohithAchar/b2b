-- Account–store membership: one account can access multiple stores.
-- Links a profile (account) to the stores it may view/manage in the supplier
-- dashboard. Seeded by the single onboarding flow for all 4 stores;
-- existing company-based supplier workflows are untouched.

create table public.account_stores (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint account_stores_profile_store_unique unique (profile_id, store_id)
);

create index account_stores_profile_idx on public.account_stores (profile_id);
create index account_stores_store_idx on public.account_stores (store_id);

alter table public.account_stores enable row level security;

-- New tables are NOT auto-exposed to the Data API. Grant explicitly, then
-- lock rows down with RLS below.
grant select on public.account_stores to anon, authenticated;

-- Public read: which stores an account has access to.
create policy "account_stores_select_public"
  on public.account_stores for select
  to anon, authenticated
  using (true);

-- Account owners manage their own store memberships.
create policy "account_stores_manage_own"
  on public.account_stores for all
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Admins manage all account–store memberships.
create policy "account_stores_admin_all"
  on public.account_stores for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Seed the single set-up account (admin@gmail.com) with access to all 4
-- stores so it can reach the dashboard directly. Idempotent.
insert into public.account_stores (profile_id, store_id)
select p.id, s.id
from public.profiles p
cross join public.stores s
where p.email = 'oxmdev0@gmail.com'
  and s.status = 'active'
on conflict (profile_id, store_id) do nothing;


