-- OpenWA notification provider.
--
-- Outbound order notifications now go through a self-hosted OpenWA gateway
-- (a linked WhatsApp account) instead of the Meta Graph API. Rows already in
-- the table keep the provider that actually handled them, so 'graph' stays
-- allowed as truthful history; every new send records 'openwa'.

alter table public.notification_outbox
  drop constraint notification_outbox_provider_check;

alter table public.notification_outbox
  add constraint notification_outbox_provider_check
  check (provider in ('mock', 'graph', 'openwa'));
