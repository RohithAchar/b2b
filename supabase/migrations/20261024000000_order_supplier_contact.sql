-- Buyer access to the supplier's contact phone, scoped per order.
--
-- `companies` has owner-only RLS (suppliers manage their own KYB row) and is
-- not exposed through any buyer-facing view, so the buyer order page cannot
-- read a phone to build its WhatsApp contact link. This SECURITY DEFINER
-- view (same pattern as the storefront views) is the single narrow window:
-- auth.uid() restricts rows to orders the caller placed, and only the three
-- contact fields needed for outreach are projected — no address, no GST, no
-- bank details.

create or replace view public.order_supplier_contact as
select
  o.id as order_id,
  o.supplier_id,
  c.business_name as supplier_name,
  c.phone
from public.orders o
join public.companies c
  on c.id = o.supplier_id
where o.buyer_id = auth.uid();

grant select on public.order_supplier_contact to authenticated;
