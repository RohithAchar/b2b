-- Staff invite lookup reachable over RPC.
--
-- Bug fix: internal.staff_candidate() lives in the non-exposed `internal`
-- schema, so supabase.rpc() from the app 404s ("Could not look up that
-- email"). The Data API only serves functions in exposed schemas, so the
-- callable entrypoint must live in `public`.
--
-- This wrapper derives the company from the caller (owners hold exactly one
-- company via companies.owner_id unique) instead of accepting a company id
-- argument, so callers cannot probe other companies. It returns only the
-- single account matching the typed email: existence + type + whether it
-- already owns a business. Non-owners get an exception, never rows.

create or replace function public.staff_candidate(p_email text)
returns table (
  user_id uuid,
  user_type text,
  owns_company_id uuid,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select id into v_company_id
  from public.companies
  where owner_id = (select auth.uid());
  if v_company_id is null then
    raise exception 'Not your company';
  end if;
  return query
    select p.id, p.user_type, c.id, p.email
    from public.profiles p
    left join public.companies c on c.owner_id = p.id
    where p.email is not null and lower(p.email) = lower(btrim(p_email));
end;
$$;

-- Default privileges grant EXECUTE to PUBLIC (hence anon): revoke first,
-- then grant only to authenticated, mirroring the table-grant pattern used
-- across this project's migrations.
revoke all on function public.staff_candidate(text) from anon, authenticated;
grant execute on function public.staff_candidate(text) to authenticated;

-- Superseded by the public wrapper above; drop to avoid a dead privileged
-- lookup with a wider signature (caller-supplied company id).
drop function if exists internal.staff_candidate(uuid, text);
