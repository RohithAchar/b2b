-- Quotations: server-side creation and buyer response.
--
-- `quotations` / `quotation_items` are read-only for clients (Phase 1); all
-- writes happen here as SECURITY DEFINER functions gated on auth.uid(), the
-- same pattern as create_orders_from_cart:
--
--   create_quotation      — supplier of the order prices the deal. Totals are
--                           computed from the submitted lines; the caller
--                           passes no subtotal/total at all. Revisions append
--                           a new version; nothing is overwritten.
--   respond_to_quotation  — only the order's buyer, only the latest pending
--                           version, only before expiry. Acceptance never
--                           marks anything paid and never confirms the order;
--                           rejection returns it to supplier review.

-- =============================================================================
-- 1. create_quotation ==========================================================
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
  v_line record;
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
-- 2. respond_to_quotation ======================================================
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
    -- order confirmation are separate supplier actions.
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
