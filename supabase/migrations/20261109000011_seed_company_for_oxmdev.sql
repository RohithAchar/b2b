-- Seed a company profile for oxmdev0@gmail.com so the supplier dashboard has
-- data to show (d2h core is company-scoped). Idempotent — only inserts if no
-- company exists for this account. The user can edit details via Business
-- profile later.
insert into public.companies (
  owner_id, business_name, contact_person, phone, address, city, state, pincode,
  kyb_status, verified_at
)
select p.id,
  'OXM Dev',
  'OXM Dev',
  '9999999999',
  '123 Main Street',
  'Mumbai',
  'Maharashtra',
  '400001',
  'verified',
  now()
from public.profiles p
where p.email = 'oxmdev0@gmail.com'
  and not exists (
    select 1 from public.companies c where c.owner_id = p.id
  );
