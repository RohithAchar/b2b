-- Traffic analytics: coarse device class on storefront events.
--
-- Nullable so historic rows keep working (the device widget shows its empty
-- state until attributed rows exist). Populated server-side from the `b2b_dev`
-- cookie, which the storefront sets once per session from the user agent.
-- Only three coarse buckets are stored — no raw user-agent strings, no PII.

alter table public.storefront_events
  add column if not exists device text
    constraint storefront_events_device_check
    check (device in ('desktop', 'mobile', 'tablet'));

comment on column public.storefront_events.device is
  'Coarse device bucket (desktop/mobile/tablet) for the views-by-device widget; null for unattributed rows.';
