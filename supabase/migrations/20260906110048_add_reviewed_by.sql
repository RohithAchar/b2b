-- Audit trail for manual KYB review: who approved/rejected each application.
alter table public.companies
  add column reviewed_by uuid references public.profiles (id) on delete set null;

-- Private helper schema (not exposed to the Data API).
create schema if not exists internal;
grant usage on schema internal to authenticated;

-- Role check used by admin RLS policies. SECURITY DEFINER is required so the
-- lookup on public.profiles is not blocked by its own owner-only policies.
-- Read-only, no arguments, lives outside exposed schemas.
create or replace function internal.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.user_type = 'admin'
  )
$$;

grant execute on function internal.is_admin() to authenticated;

-- Close the privilege-escalation hole: without this, any authenticated user
-- could set their own profiles.user_type to 'admin' through the Data API.
-- Allowed transitions: self buyer->supplier (supplier onboarding), or any
-- change made by an admin.
create or replace function internal.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_type is not distinct from old.user_type then
    return new;
  end if;
  if internal.is_admin() then
    return new;
  end if;
  if old.user_type = 'buyer'
     and new.user_type = 'supplier'
     and old.id = (select auth.uid()) then
    return new;
  end if;
  raise exception 'user_type change not permitted';
end;
$$;

drop trigger if exists prevent_role_escalation on public.profiles;

create trigger prevent_role_escalation
  before update on public.profiles
  for each row execute function internal.prevent_role_escalation();

-- Admins see and decide all supplier applications.
create policy "companies_admin_all"
  on public.companies for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Admins can read profiles (reviewer names, applicant lookup).
create policy "profiles_admin_select"
  on public.profiles for select
  to authenticated
  using (internal.is_admin());

-- Admins can open applicant documents for review.
create policy "company_docs_admin_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'company_docs' and internal.is_admin());
