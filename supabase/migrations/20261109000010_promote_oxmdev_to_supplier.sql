-- Ensure oxmdev0@gmail.com has store access so it can reach the supplier
-- dashboard. user_type promotion happens automatically on first dashboard
-- visit (buyer -> supplier is an allowed self-transition). Idempotent.
insert into public.account_stores (profile_id, store_id)
select p.id, s.id
from public.profiles p
cross join public.stores s
where p.email = 'oxmdev0@gmail.com'
  and s.status = 'active'
on conflict (profile_id, store_id) do nothing;
