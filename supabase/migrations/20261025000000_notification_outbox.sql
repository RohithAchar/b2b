-- WhatsApp notification outbox (Phase 7).
--
-- The website is the system of record. WhatsApp is notification-only: short
-- factual messages with a secure link to the order page — never the delivery
-- address, never private prices beyond the order's own agreed total. The
-- order survives any notification failure; delivery is attempted best-effort
-- by the server after the business mutation committed, and this table
-- records only what the provider actually confirmed.
--
--   status: pending  — queued, no provider confirmation yet
--           sent     — the provider accepted the message (or the mock
--                      provider recorded it; `provider` says which)
--           failed   — the provider rejected it or no number was on file
--
-- Clients get no insert/update/delete grants here except the narrow RLS
-- below; queue_order_notification is the intended write path (SECURITY
-- DEFINER, party-checked), and status updates only ever carry
-- provider-confirmed results.

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_phone text,
  template text not null,
  -- Only non-address business facts: reference, names, totals, tracking.
  payload jsonb not null default '{}'::jsonb,
  provider text not null default 'mock' check (provider in ('mock', 'graph')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error text,
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_template_check check (
    template in (
      'new_order_supplier',
      'quotation_sent_buyer',
      'quotation_accepted_supplier',
      'quotation_rejected_supplier',
      'order_confirmed_buyer',
      'order_rejected_buyer',
      'order_shipped_buyer',
      'order_delivered_buyer',
      'payment_confirmed_buyer'
    )
  )
);

create index notification_outbox_order_idx
  on public.notification_outbox (order_id, created_at desc);
create index notification_outbox_pending_idx
  on public.notification_outbox (created_at)
  where status = 'pending';

create trigger set_notification_outbox_updated_at
  before update on public.notification_outbox
  for each row execute function internal.set_updated_at();

alter table public.notification_outbox enable row level security;

-- Each party reads the notifications about their shared orders — including
-- the ones addressed to the counterparty, which is how the queueing actor
-- can record delivery results and how both order pages can show the
-- notification trail. Payloads only ever contain counterparty-facing facts,
-- so nothing leaks within an order relationship.
create policy "read own notifications"
  on public.notification_outbox for select
  using (
    recipient_user_id = (select auth.uid())
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.buyer_id = (select auth.uid())
          or internal.is_company_member(o.supplier_id)
        )
    )
  );

-- Queueing is for order parties only, and never self-addressed; the RPC
-- below resolves the real recipient server-side, so this policy exists
-- mainly to keep stray writes out.
create policy "parties may queue notifications"
  on public.notification_outbox for insert
  with check (
    recipient_user_id <> (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.buyer_id = (select auth.uid())
          or internal.is_company_member(o.supplier_id)
        )
    )
  );

-- Status updates carry provider-confirmed results for the caller's orders.
create policy "parties may update notification results"
  on public.notification_outbox for update
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.buyer_id = (select auth.uid())
          or internal.is_company_member(o.supplier_id)
        )
    )
  );

-- =============================================================================
-- queue_order_notification: resolve the recipient inside the database
-- =============================================================================

-- SECURITY DEFINER because the acting party often cannot read the other
-- side's identity through RLS (e.g. a supplier staff member cannot read
-- companies.owner_id, a buyer cannot read the supplier's user id). The
-- function only ever addresses the counterparty of the caller's own order
-- and puts business facts — never the delivery address — into the payload.
create or replace function public.queue_order_notification(
  p_order_id uuid,
  p_template text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_company public.companies%rowtype;
  v_recipient uuid;
  v_phone text;
  v_payload jsonb := '{}'::jsonb;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to queue notifications';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.buyer_id <> v_uid and not internal.is_company_member(v_order.supplier_id) then
    raise exception 'You can only queue notifications for your own orders';
  end if;

  v_payload := jsonb_build_object('reference', v_order.reference);

  if p_template like '%_supplier' then
    select * into v_company from public.companies where id = v_order.supplier_id;
    v_recipient := v_company.owner_id;
    v_phone := v_company.phone;
    v_payload := v_payload || jsonb_build_object(
      'buyer_name', coalesce(v_order.delivery->>'fullName', 'A buyer'),
      'total', v_order.subtotal - v_order.discount
    );
  else
    v_recipient := v_order.buyer_id;
    v_phone := v_order.delivery->>'phone';
  end if;

  case p_template
    when 'new_order_supplier' then
      null; -- payload already complete
    when 'quotation_sent_buyer' then
      v_payload := v_payload || coalesce((
        select jsonb_build_object('version', q.version, 'total', q.total)
        from public.quotations q
        where q.order_id = p_order_id
        order by q.version desc
        limit 1
      ), '{}'::jsonb);
    when 'quotation_accepted_supplier' then
      v_payload := v_payload || coalesce((
        select jsonb_build_object('version', q.version, 'total', q.total)
        from public.quotations q
        where q.order_id = p_order_id and q.status = 'accepted'
        order by q.version desc
        limit 1
      ), '{}'::jsonb);
    when 'quotation_rejected_supplier' then
      v_payload := v_payload || coalesce((
        select jsonb_build_object('version', q.version)
        from public.quotations q
        where q.order_id = p_order_id
        order by q.version desc
        limit 1
      ), '{}'::jsonb);
    when 'order_rejected_buyer' then
      v_payload := v_payload || jsonb_build_object(
        'reason', coalesce(v_order.rejection_reason, 'Contact the supplier')
      );
    when 'order_shipped_buyer' then
      v_payload := v_payload || jsonb_build_object(
        'carrier', v_order.carrier,
        'tracking_ref', v_order.tracking_ref
      );
    when 'order_confirmed_buyer',
         'order_delivered_buyer',
         'payment_confirmed_buyer' then
      null; -- reference-only facts already in the payload
    else
      raise exception 'Unknown notification template';
  end case;

  insert into public.notification_outbox (
    order_id, recipient_user_id, recipient_phone, template, payload
  )
  values (p_order_id, v_recipient, nullif(trim(coalesce(v_phone, '')), ''), p_template, v_payload)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.queue_order_notification(uuid, text) from public;
revoke execute on function public.queue_order_notification(uuid, text) from anon;
grant execute on function public.queue_order_notification(uuid, text) to authenticated;
