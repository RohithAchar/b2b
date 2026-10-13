-- Sales analytics attribution: buyer region on orders, traffic source on events.
--
-- Both columns are nullable so historic rows keep working (widgets show
-- "not enough data" until attributed rows exist). They are populated by
-- server actions at write time and backfilled for seed rows by
-- `backfillDemoAttribution` in supabase/seed.mjs. Neither column carries
-- PII: region is a city-level label, source is a coarse acquisition bucket.

alter table public.orders
  add column if not exists region text;

alter table public.storefront_events
  add column if not exists source text
    constraint storefront_events_source_check
    check (source in ('direct', 'search', 'social', 'referral'));

comment on column public.orders.region is
  'Buyer city/region label for the sales-by-region widget. Set at order time; null for unattributed rows.';
comment on column public.storefront_events.source is
  'Coarse acquisition bucket derived from the referrer at session start; null for unattributed rows.';
