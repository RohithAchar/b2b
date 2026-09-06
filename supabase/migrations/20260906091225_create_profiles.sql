-- Profiles for B2B marketplace auth (auth-only phase).
-- One row per auth user. user_type defaults to 'buyer'; supplier onboarding comes later.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  user_type text not null default 'buyer'
    constraint profiles_user_type_check check (user_type in ('buyer', 'supplier', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- New tables are NOT auto-exposed to the Data API (Supabase breaking change,
-- enforced Oct 2026). Grant explicitly, then lock rows down with RLS below.
grant select, insert, update on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- Self read: needed for guards + profile display.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (((select auth.uid())) = id);

-- Self insert (defense in depth; trigger below is the primary creator).
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (((select auth.uid())) = id);

-- Self update: UPDATE requires a SELECT policy (present above) plus
-- USING + WITH CHECK so a user cannot reassign a row to another id.
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (((select auth.uid())) = id)
  with check (((select auth.uid())) = id);

-- Auto-create a profile on signup. This is the documented Supabase trigger
-- pattern: SECURITY DEFINER is required here because the trigger fires on
-- auth.users (a session-less context where auth.uid() is unavailable).
-- Hardened with a fixed search_path and fully-qualified table name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
