-- Correct order totals and quotation lifecycle.
--
-- 1. `orders.subtotal` is the amount owed AFTER a coupon, so every place that
--    displayed `subtotal - discount` was subtracting the discount twice.
--    Notifications now use the stored subtotal, or the accepted quotation total
--    when one exists.
-- 2. A new quotation revision marks older `sent` revisions as `superseded`
--    instead of leaving multiple pending rows around. Once a quotation is
--    accepted, no further revisions are allowed.
-- 3. `respond_to_quotation` no longer rewrites order status on acceptance;
--    acceptance is recorded on the quotation only. Order confirmation remains a
--    separate supplier action.

-- =============================================================================
-- 1. Quotation status vocabulary
-- =============================================================================

alter table public.quotations drop constraint if exists quotations_status_check;
alter table public.quotations
  add constraint quotations_status_check
  check (status in ('sent', 'accepted', 'rejected', 'expired', 'superseded'));

-- =============================================================================
-- 2. create_quotation: supersede older pending revisions
-- =============================================================================

create or replace function public.create_quotation(
  p_order_id uuid,
  p_lines jsonb,
  p_delivery_charge numeric default 0,
  p_tax_amount numeric default 0,
  p_note text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_supplier_id uuid;
  v_status text;
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_version integer;
  v_quotation_id uuid;
  v_order_item_ids uuid[];
  v_used_ids uuid[] := '{}';
  v_ids uuid[] := '{}';
  v_qtys integer[] := '{}';
  v_prices numeric[] := '{}';
  v_line jsonb;
  v_id uuid;
  v_qty integer;
  v_price numeric(12, 2);
  v_title text;
  v_variant_label text;
  v_unit text;
begin
  if v_uid is null then
    raise exception 'You must be signed in to send a quotation';
  end if;

  select o.supplier_id, o.status
    into v_supplier_id, v_status
  from public.orders o
  where o.id = p_order_id;
  if not found then
    raise exception 'Order not found';
  end if;
  if not internal.is_company_member(v_supplier_id) then
    raise exception 'You do not manage this order';
  end if;
  if v_status not in ('new', 'quoted') then
    raise exception 'This order can no longer be quoted in its current state';
  end if;
  if exists (
    select 1 from public.quotations
    where order_id = p_order_id and status = 'accepted'
  ) then
    raise exception 'The buyer already accepted a quotation for this order';
  end if;

  if p_delivery_charge is null or p_delivery_charge < 0 or p_delivery_charge > 10000000 then
    raise exception 'Invalid delivery charge';
  end if;
  if p_tax_amount is null or p_tax_amount < 0 or p_tax_amount > 10000000 then
    raise exception 'Invalid tax amount';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Keep the note under 500 characters';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiry must be in the future';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line to the quotation';
  end if;

  select array_agg(id) into v_order_item_ids
  from public.order_items
  where order_id = p_order_id;

  -- Validate + price every line; totals are computed here, never accepted.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    if coalesce(v_line->>'order_item_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid quotation line';
    end if;
    v_id := (v_line->>'order_item_id')::uuid;
    if not exists (select 1 from unnest(v_order_item_ids) x where x = v_id) then
      raise exception 'Quotation lines must match the ordered items';
    end if;
    if v_id = any (v_used_ids) then
      raise exception 'Duplicate quotation line';
    end if;
    if coalesce(v_line->>'quantity', '') !~ '^[0-9]{1,6}$' then
      raise exception 'Invalid quantity';
    end if;
    if coalesce(v_line->>'unit_price', '') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' then
      raise exception 'Invalid unit price';
    end if;
    v_qty := (v_line->>'quantity')::integer;
    v_price := (v_line->>'unit_price')::numeric;
    if v_qty < 1 then
      raise exception 'Quantity must be at least 1';
    end if;

    v_used_ids := array_append(v_used_ids, v_id);
    v_ids := array_append(v_ids, v_id);
    v_qtys := array_append(v_qtys, v_qty);
    v_prices := array_append(v_prices, v_price);
    v_subtotal := v_subtotal + round(v_price * v_qty, 2);
  end loop;

  v_total := v_subtotal + p_delivery_charge + p_tax_amount;

  -- Only the newest revision stays actionable. Older pending revisions are
  -- kept for history but can no longer be accepted by the buyer.
  update public.quotations
  set status = 'superseded'
  where order_id = p_order_id and status = 'sent';

  select coalesce(max(version), 0) + 1 into v_version
  from public.quotations
  where order_id = p_order_id;

  insert into public.quotations (
    order_id, version, status, subtotal, delivery_charge, tax_amount, total,
    note, expires_at, created_by
  )
  values (
    p_order_id, v_version, 'sent', v_subtotal, p_delivery_charge, p_tax_amount,
    v_total,
    nullif(trim(coalesce(p_note, '')), ''),
    p_expires_at, v_uid
  )
  returning id into v_quotation_id;

  for i in 1 .. array_length(v_ids, 1) loop
    select oi.title, oi.variant_label, oi.unit
      into v_title, v_variant_label, v_unit
    from public.order_items oi
    where oi.id = v_ids[i] and oi.order_id = p_order_id;

    insert into public.quotation_items (
      quotation_id, order_item_id, title, variant_label, unit,
      quantity, unit_price, line_total
    )
    values (
      v_quotation_id, v_ids[i], v_title, v_variant_label, v_unit,
      v_qtys[i], v_prices[i], round(v_prices[i] * v_qtys[i], 2)
    );
  end loop;

  -- Order follows the quote: awaiting review -> quotation pending.
  update public.orders
  set status = 'quoted'
  where id = p_order_id and status in ('new', 'quoted');

  insert into public.order_events (order_id, event, actor_id, data)
  values (
    p_order_id,
    'quotation_created',
    v_uid,
    jsonb_build_object('version', v_version, 'total', v_total)
  );

  return jsonb_build_object(
    'quotation_id', v_quotation_id,
    'version', v_version,
    'subtotal', v_subtotal,
    'total', v_total
  );
end;
$$;

revoke execute on function public.create_quotation(uuid, jsonb, numeric, numeric, text, timestamptz) from public;
revoke execute on function public.create_quotation(uuid, jsonb, numeric, numeric, text, timestamptz) from anon;
grant execute on function public.create_quotation(uuid, jsonb, numeric, numeric, text, timestamptz) to authenticated;

-- =============================================================================
-- 3. respond_to_quotation: acceptance stays on the quotation
-- =============================================================================

create or replace function public.respond_to_quotation(
  p_quotation_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_quote public.quotations%rowtype;
  v_order public.orders%rowtype;
  v_latest_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to respond to a quotation';
  end if;
  if p_quotation_id is null then
    raise exception 'Quotation not found';
  end if;

  select * into v_quote from public.quotations where id = p_quotation_id;
  if not found then
    raise exception 'Quotation not found';
  end if;
  select * into v_order from public.orders where id = v_quote.order_id;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'You can only respond to quotations on your own orders';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'This quotation is no longer awaiting a response';
  end if;
  if v_quote.expires_at is not null and v_quote.expires_at <= now() then
    raise exception 'This quotation has expired; ask the supplier for a revised quote';
  end if;
  if v_order.status <> 'quoted' then
    raise exception 'This order is not awaiting a quotation response';
  end if;

  -- Only the newest pending version is actionable: a supplier revision
  -- invalidates responses to superseded versions.
  select id into v_latest_id
  from public.quotations
  where order_id = v_quote.order_id and status = 'sent'
  order by version desc
  limit 1;
  if v_latest_id is distinct from v_quote.id then
    raise exception 'This quotation has been revised; review the latest version';
  end if;

  if coalesce(p_accept, false) then
    update public.quotations
    set status = 'accepted', accepted_by = v_uid, accepted_at = now()
    where id = v_quote.id;

    insert into public.order_events (order_id, event, actor_id, data)
    values (
      v_quote.order_id, 'quotation_accepted', v_uid,
      jsonb_build_object('version', v_quote.version, 'total', v_quote.total)
    );

    -- Acceptance is approval of the quoted deal only. Payment status and
    -- order confirmation are separate supplier actions, so the order stays
    -- `quoted` until the supplier explicitly confirms it.
    return jsonb_build_object(
      'status', 'accepted',
      'version', v_quote.version,
      'total', v_quote.total,
      'order_status', v_order.status
    );
  end if;

  update public.quotations
  set status = 'rejected', rejected_at = now()
  where id = v_quote.id;

  -- Back to supplier review with the original order intact.
  update public.orders
  set status = 'new'
  where id = v_quote.order_id and status = 'quoted';

  insert into public.order_events (order_id, event, actor_id, data)
  values (
    v_quote.order_id, 'quotation_rejected', v_uid,
    jsonb_build_object('version', v_quote.version, 'total', v_quote.total)
  );

  return jsonb_build_object(
    'status', 'rejected',
    'version', v_quote.version,
    'total', v_quote.total,
    'order_status', 'new'
  );
end;
$$;

revoke execute on function public.respond_to_quotation(uuid, boolean) from public;
revoke execute on function public.respond_to_quotation(uuid, boolean) from anon;
grant execute on function public.respond_to_quotation(uuid, boolean) to authenticated;

-- =============================================================================
-- 4. Notifications use the stored (already discounted) subtotal
-- =============================================================================

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
  v_total numeric(12, 2);
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

  -- `subtotal` already has the coupon applied. An accepted quotation is the
  -- authoritative agreed amount when one exists.
  select coalesce(
    (
      select q.total
      from public.quotations q
      where q.order_id = p_order_id and q.status = 'accepted'
      order by q.version desc
      limit 1
    ),
    v_order.subtotal
  )
  into v_total;

  v_payload := jsonb_build_object('reference', v_order.reference);

  if p_template like '%_supplier' then
    select * into v_company from public.companies where id = v_order.supplier_id;
    v_recipient := v_company.owner_id;
    v_phone := v_company.phone;
    v_payload := v_payload || jsonb_build_object(
      'buyer_name', coalesce(v_order.delivery->>'fullName', 'A buyer'),
      'total', v_total
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
      v_payload := v_payload || jsonb_build_object(
        'payment_reference', v_order.payment_claim_reference,
        'total', v_total
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
