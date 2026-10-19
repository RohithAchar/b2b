-- Buyer payment claim workflow.
--
-- Money still moves directly between buyer and supplier — the platform never
-- handles it. What this migration adds is a truthful record of intent: after a
-- deal is agreed the buyer can say "I have paid" with a UPI/UTR reference, and
-- the supplier can then either confirm receipt (payment_status = 'paid') or
-- say the money did not arrive (back to 'pending').
--
-- The buyer can never mark an order paid; only the supplier's own confirmation
-- reaches 'paid' (see internal.guard_order_update). A buyer claim is recorded
-- as 'claimed' and is cleared if the supplier reports it was not received.

-- =============================================================================
-- 1. Columns + payment status vocabulary ======================================
-- =============================================================================

alter table public.orders
  add column if not exists payment_claim_reference text,
  add column if not exists payment_claimed_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('not_requested', 'pending', 'claimed', 'paid'));

-- =============================================================================
-- 2. Guard trigger: allow the buyer claim, add supplier claim resolutions =====
-- =============================================================================

create or replace function internal.guard_order_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_supplier_side boolean;
begin
  -- Service role (seed/scripts) and admins bypass the guard.
  if v_uid is null or internal.is_admin() then
    return new;
  end if;

  v_supplier_side := internal.is_company_member(new.supplier_id);
  if not v_supplier_side then
    -- The only buyer-side order writes are performed by SECURITY DEFINER RPCs
    -- (RLS gives buyers no UPDATE policy), so this branch is reachable only
    -- through those functions.

    -- Quote rejection (respond_to_quotation): status quoted -> new, nothing
    -- else touched, and only on their own order.
    if new.buyer_id = v_uid
       and old.status = 'quoted' and new.status = 'new'
       and new.payment_status is not distinct from old.payment_status
       and new.subtotal is not distinct from old.subtotal
       and new.delivery is not distinct from old.delivery
       and new.buyer_note is not distinct from old.buyer_note
       and new.supplier_note is not distinct from old.supplier_note then
      return new;
    end if;

    -- Payment claim (claim_order_payment): order status unchanged, payment
    -- moves to 'claimed' with a reference, and nothing the supplier owns is
    -- touched. A buyer can never reach 'paid'.
    if new.buyer_id = v_uid
       and new.status is not distinct from old.status
       and old.payment_status in ('not_requested', 'pending')
       and new.payment_status = 'claimed'
       and new.payment_claim_reference is not null
       and new.payment_confirmed_by is not distinct from old.payment_confirmed_by
       and new.payment_confirmed_at is not distinct from old.payment_confirmed_at
       and new.subtotal is not distinct from old.subtotal
       and new.discount is not distinct from old.discount
       and new.item_count is not distinct from old.item_count
       and new.delivery is not distinct from old.delivery
       and new.buyer_note is not distinct from old.buyer_note
       and new.supplier_note is not distinct from old.supplier_note
       and new.reference is not distinct from old.reference
       and new.supplier_id is not distinct from old.supplier_id
       and new.created_at is not distinct from old.created_at
       and new.region is not distinct from old.region then
      return new;
    end if;

    raise exception 'Only the supplier can update an order directly';
  end if;

  -- Immutable core: identity, ownership, money, delivery snapshot, buyer text.
  if new.id is distinct from old.id then
    raise exception 'id cannot be changed';
  end if;
  if new.supplier_id is distinct from old.supplier_id then
    raise exception 'supplier_id cannot be changed';
  end if;
  if new.buyer_id is distinct from old.buyer_id then
    raise exception 'buyer_id cannot be changed';
  end if;
  if new.reference is distinct from old.reference then
    raise exception 'reference cannot be changed';
  end if;
  if new.subtotal is distinct from old.subtotal then
    raise exception 'subtotal cannot be changed (revise via a quotation)';
  end if;
  if new.item_count is distinct from old.item_count then
    raise exception 'item_count cannot be changed';
  end if;
  if new.delivery is distinct from old.delivery then
    raise exception 'delivery snapshot cannot be changed';
  end if;
  if new.buyer_note is distinct from old.buyer_note then
    raise exception 'buyer_note cannot be changed';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at cannot be changed';
  end if;
  if new.region is distinct from old.region then
    raise exception 'region cannot be changed';
  end if;

  -- Order status lifecycle.
  if new.status is distinct from old.status then
    if not exists (
      select 1 from (values
        ('new', 'quoted'),
        ('new', 'confirmed'),
        ('new', 'cancelled'),
        ('quoted', 'new'),
        ('quoted', 'confirmed'),
        ('quoted', 'cancelled'),
        ('confirmed', 'processing'),
        ('confirmed', 'cancelled'),
        ('processing', 'shipped'),
        ('processing', 'cancelled'),
        ('shipped', 'delivered')
      ) as t(from_status, to_status)
      where t.from_status = old.status and t.to_status = new.status
    ) then
      raise exception 'Order status cannot move from % to %', old.status, new.status;
    end if;

    -- Stage timestamps are recorded here so every writer gets them right.
    if new.status = 'shipped' and new.shipped_at is null then
      new.shipped_at := now();
    end if;
    if new.status = 'delivered' and new.delivered_at is null then
      new.delivered_at := now();
    end if;
    if new.status = 'cancelled' and new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;

  -- Payment status is separate from order status and supplier-controlled.
  -- `claimed` is reached by the buyer RPC above; from there the supplier either
  -- confirms receipt ('paid') or reports the money did not arrive ('pending').
  if new.payment_status is distinct from old.payment_status then
    if not exists (
      select 1 from (values
        ('not_requested', 'pending'),
        ('not_requested', 'paid'),
        ('pending', 'paid'),
        ('claimed', 'paid'),
        ('claimed', 'pending')
      ) as t(from_status, to_status)
      where t.from_status = old.payment_status and t.to_status = new.payment_status
    ) then
      raise exception 'Payment status cannot move from % to %', old.payment_status, new.payment_status;
    end if;

    if new.payment_status = 'paid' then
      -- Record who confirmed receipt and when. Never derived from a buyer
      -- action; only a supplier-side actor reaches this branch. The buyer's
      -- claim reference is kept as history.
      new.payment_confirmed_by := v_uid;
      new.payment_confirmed_at := now();
    elsif new.payment_status = 'claimed' then
      new.payment_confirmed_by := null;
      new.payment_confirmed_at := null;
      if new.payment_claimed_at is null then
        new.payment_claimed_at := now();
      end if;
    else
      new.payment_confirmed_by := null;
      new.payment_confirmed_at := null;
      -- Back to 'pending' means the supplier did not receive the claim's
      -- money; clear the stale claim so the buyer can submit again.
      if new.payment_status = 'pending' then
        new.payment_claim_reference := null;
        new.payment_claimed_at := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- 3. Buyer claim RPC ==========================================================
-- =============================================================================

create or replace function public.claim_order_payment(
  p_order_id uuid,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_ref text := upper(trim(coalesce(p_reference, '')));
begin
  if v_uid is null then
    raise exception 'You must be signed in to record a payment';
  end if;

  if v_ref !~ '^[A-Z0-9][A-Z0-9-]{5,29}$' then
    raise exception 'Enter the payment reference (6-30 letters, digits or dashes)';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'You can only record payment for your own order';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'This order was cancelled';
  end if;
  if v_order.payment_status not in ('not_requested', 'pending') then
    raise exception 'A payment is already recorded for this order';
  end if;

  update public.orders
  set payment_status = 'claimed',
      payment_claim_reference = v_ref,
      payment_claimed_at = now()
  where id = p_order_id;

  return jsonb_build_object('status', 'claimed', 'reference', v_ref);
end;
$$;

revoke execute on function public.claim_order_payment(uuid, text) from public;
revoke execute on function public.claim_order_payment(uuid, text) from anon;
grant execute on function public.claim_order_payment(uuid, text) to authenticated;

-- =============================================================================
-- 4. Audit: keep the claim reference on the payment event =====================
-- =============================================================================

create or replace function internal.audit_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, event, actor_id, data)
    values (
      new.id,
      'status_changed',
      v_uid,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  if new.payment_status is distinct from old.payment_status then
    insert into public.order_events (order_id, event, actor_id, data)
    values (
      new.id,
      'payment_status_changed',
      v_uid,
      jsonb_build_object(
        'from', old.payment_status,
        'to', new.payment_status,
        'confirmed_by', new.payment_confirmed_by,
        'reference', new.payment_claim_reference
      )
    );
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into public.order_events (order_id, event, actor_id, data)
    values (
      new.id,
      'order_cancelled',
      v_uid,
      jsonb_build_object('reason', new.rejection_reason)
    );
  end if;

  return new;
end;
$$;

-- =============================================================================
-- 5. Notification templates: buyer claim -> supplier, not-received -> buyer ===
-- =============================================================================

alter table public.notification_outbox
  drop constraint notification_outbox_template_check;

alter table public.notification_outbox
  add constraint notification_outbox_template_check check (
    template in (
      'new_order_supplier',
      'quotation_sent_buyer',
      'quotation_accepted_supplier',
      'quotation_rejected_supplier',
      'order_confirmed_buyer',
      'order_rejected_buyer',
      'order_shipped_buyer',
      'order_delivered_buyer',
      'payment_confirmed_buyer',
      'payment_claimed_supplier',
      'payment_not_received_buyer'
    )
  );

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
    when 'payment_claimed_supplier' then
      -- Prefer the agreed quotation total over the raw cart subtotal.
      v_payload := v_payload || jsonb_build_object(
        'payment_reference', v_order.payment_claim_reference,
        'total', coalesce((
          select q.total from public.quotations q
          where q.order_id = p_order_id and q.status = 'accepted'
          order by q.version desc
          limit 1
        ), v_order.subtotal - v_order.discount)
      );
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
         'payment_confirmed_buyer',
         'payment_not_received_buyer' then
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
