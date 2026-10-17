-- Checkout: server-side order creation from the buyer's cart.
--
-- `create_orders_from_cart` is the ONLY way orders are created. It is a
-- SECURITY DEFINER function gated on auth.uid() (same pattern as submit_kyb
-- etc.), so no client-side price, total, supplier id or role is ever trusted:
-- every financial value is recomputed here from canonical database data
-- (products, product_variants and the storefront_prices view).
--
-- A cart with products from N suppliers creates N independent orders inside
-- one transaction: either every supplier order exists or none does.
-- A repeat of the same request (double-click, retry, timeout) returns the
-- originally created orders instead of creating duplicates.

-- =============================================================================
-- 1. Order discount column =====================================================
-- =============================================================================

-- `subtotal` stays the amount the buyer owes for this supplier AFTER the
-- coupon discount (so existing analytics that sum subtotal stay truthful);
-- `discount` records what was taken off, and `coupon_id` (added with the
-- coupons migration) records the code applied.
alter table public.orders
  add column if not exists discount numeric(12, 2) not null default 0;

alter table public.orders drop constraint if exists orders_discount_check;
alter table public.orders
  add constraint orders_discount_check check (discount >= 0);

-- =============================================================================
-- 2. Checkout idempotency ======================================================
-- =============================================================================

-- One row per successful checkout request, keyed by (buyer, client-generated
-- request uuid). Written only by the RPC below; buyers may read their own
-- rows so a retried request can be recognized after a lost response.
create table public.order_checkout_requests (
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  key uuid not null,
  order_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (buyer_id, key)
);

alter table public.order_checkout_requests enable row level security;

grant select on public.order_checkout_requests to authenticated;
revoke all on public.order_checkout_requests from anon;

create policy "order_checkout_requests_select_own"
  on public.order_checkout_requests for select
  to authenticated
  using (buyer_id = ((select auth.uid())));

-- =============================================================================
-- 3. create_orders_from_cart ===================================================
-- =============================================================================

create or replace function public.create_orders_from_cart(
  p_delivery jsonb,
  p_buyer_note text default null,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_existing jsonb;
  v_orders jsonb := '[]'::jsonb;
  v_skipped integer := 0;
  -- Validated line buffers (one entry per orderable cart line).
  v_products uuid[] := '{}';
  v_variants uuid[] := '{}';
  v_quantities integer[] := '{}';
  v_prices numeric[] := '{}';
  v_titles text[] := '{}';
  v_units text[] := '{}';
  v_variant_labels text[] := '{}';
  v_suppliers uuid[] := '{}';
  v_line_total numeric(12, 2);
  v_cart_total numeric(12, 2) := 0;
  rec record;
  s uuid;
  i integer;
  v_group_subtotal numeric(12, 2);
  v_group_items integer;
  v_coupon public.coupons%rowtype;
  v_coupon_id uuid;
  v_discount numeric(12, 2) := 0;
  v_order_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to place an order';
  end if;
  if p_idempotency_key is null then
    raise exception 'Missing checkout request id';
  end if;

  -- Delivery snapshot validation (mirrors lib/orders/delivery.ts).
  if coalesce(p_delivery->>'fullName', '') = ''
     or coalesce(p_delivery->>'phone', '') = ''
     or coalesce(p_delivery->>'line1', '') = ''
     or coalesce(p_delivery->>'city', '') = ''
     or coalesce(p_delivery->>'state', '') = ''
     or coalesce(p_delivery->>'pincode', '') = ''
     or char_length(coalesce(p_delivery->>'fullName', '')) > 80
     or char_length(coalesce(p_delivery->>'line1', '')) > 200
     or char_length(coalesce(p_delivery->>'line2', '')) > 200
     or char_length(coalesce(p_delivery->>'city', '')) > 80
     or char_length(coalesce(p_delivery->>'state', '')) > 80
     or char_length(coalesce(p_delivery->>'instructions', '')) > 500 then
    raise exception 'Delivery address is incomplete or invalid';
  end if;
  if p_delivery->>'phone' !~ '^[6-9][0-9]{9}$' then
    raise exception 'Invalid phone number';
  end if;
  if p_delivery->>'pincode' !~ '^[1-9][0-9]{5}$' then
    raise exception 'Invalid PIN code';
  end if;

  -- Replay: a repeated request returns the orders the first attempt created.
  select r.order_ids into v_existing
  from public.order_checkout_requests r
  where r.buyer_id = v_uid and r.key = p_idempotency_key;
  if found then
    return jsonb_build_object('orders', v_existing, 'duplicate', true, 'skipped', 0);
  end if;

  -- Validate and price every line from canonical data. Lines that are no
  -- longer orderable (hidden/unapproved product, deleted variant, missing
  -- price) are skipped, exactly like the cart summary, and reported back.
  for rec in
    select
      ci.product_id,
      ci.variant_id,
      ci.quantity,
      p.title,
      p.unit,
      p.supplier_id,
      coalesce(v.moq, p.moq) as effective_moq,
      v.label as variant_label,
      case
        when ci.variant_id is not null then
          (select (cv->>'customer_price')::numeric
             from jsonb_array_elements(sp.customer_variant_prices) cv
            where cv->>'id' = ci.variant_id::text)
        else
          least(
            sp.customer_price,
            coalesce(
              (select min((s2.slab->>'price')::numeric)
                 from jsonb_array_elements(sp.customer_price_slabs) s2(slab)
                where (s2.slab->>'min_qty')::integer <= ci.quantity),
              sp.customer_price
            )
          )
      end as unit_price
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    left join public.product_variants v
      on v.id = ci.variant_id and v.product_id = ci.product_id
    left join public.storefront_prices sp on sp.product_id = ci.product_id
    where ci.buyer_id = v_uid
  loop
    if rec.unit_price is null
       or (rec.variant_id is not null and rec.variant_label is null) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if rec.quantity < 1 then
      raise exception 'Invalid quantity in your cart';
    end if;
    if rec.quantity < rec.effective_moq then
      raise exception 'Minimum order quantity not met for %', rec.title;
    end if;

    v_line_total := round(rec.unit_price * rec.quantity, 2);
    v_products := array_append(v_products, rec.product_id);
    v_variants := array_append(v_variants, rec.variant_id);
    v_quantities := array_append(v_quantities, rec.quantity);
    v_prices := array_append(v_prices, rec.unit_price);
    v_titles := array_append(v_titles, rec.title);
    v_units := array_append(v_units, rec.unit);
    v_variant_labels := array_append(v_variant_labels, rec.variant_label);
    v_suppliers := array_append(v_suppliers, rec.supplier_id);
    v_cart_total := v_cart_total + v_line_total;
  end loop;

  if array_length(v_products, 1) is null then
    raise exception 'Your cart has no orderable items';
  end if;
  -- Cart-wide minimum, mirroring MIN_CART_VALUE in lib/buyer/cart.ts.
  if v_cart_total < 2500 then
    raise exception 'The minimum order value is Rs 2,500';
  end if;

  -- One order per supplier, all inside this single transaction.
  for s in
    select distinct sup from unnest(v_suppliers) sup order by sup
  loop
    v_group_subtotal := 0;
    v_group_items := 0;
    for i in 1 .. array_length(v_products, 1) loop
      if v_suppliers[i] = s then
        v_group_subtotal := v_group_subtotal + round(v_prices[i] * v_quantities[i], 2);
        v_group_items := v_group_items + v_quantities[i];
      end if;
    end loop;

    -- Coupon for this supplier, revalidated server-side at checkout time.
    v_coupon_id := null;
    v_discount := 0;
    select c.* into v_coupon
    from public.cart_coupons cc
    join public.coupons c on c.supplier_id = cc.supplier_id and c.code = cc.code
    where cc.buyer_id = v_uid and cc.supplier_id = s;
    if found
       and v_coupon.is_active
       and (v_coupon.expires_at is null or v_coupon.expires_at > now())
       and (v_coupon.usage_limit is null or v_coupon.used_count < v_coupon.usage_limit)
       and v_group_subtotal >= v_coupon.min_order_value then
      if v_coupon.type = 'percent' then
        v_discount := round(v_group_subtotal * v_coupon.percent_value / 100);
        if v_coupon.max_discount is not null then
          v_discount := least(v_discount, v_coupon.max_discount);
        end if;
      elsif v_coupon.type = 'flat' then
        v_discount := least(greatest(coalesce(v_coupon.flat_value, 0), 0), v_group_subtotal);
      end if;
      -- Other coupon types (freebie / free shipping / buy-x-get-y / loyalty)
      -- fulfil at checkout in a later phase and carry no priced discount.
      v_discount := greatest(v_discount, 0);
      v_coupon_id := v_coupon.id;
    end if;

    insert into public.orders (
      supplier_id, buyer_id, status, subtotal, discount, coupon_id,
      item_count, delivery, buyer_note, region
    )
    values (
      s, v_uid, 'new', v_group_subtotal - v_discount, v_discount, v_coupon_id,
      v_group_items, p_delivery,
      nullif(trim(coalesce(p_buyer_note, '')), ''),
      p_delivery->>'state'
    )
    returning id into v_order_id;

    for i in 1 .. array_length(v_products, 1) loop
      if v_suppliers[i] = s then
        insert into public.order_items (
          order_id, product_id, variant_id, quantity, unit_price,
          title, variant_label, unit
        )
        values (
          v_order_id, v_products[i], v_variants[i], v_quantities[i], v_prices[i],
          v_titles[i], v_variant_labels[i], v_units[i]
        );
      end if;
    end loop;

    if v_coupon_id is not null and v_discount > 0 then
      update public.coupons
      set used_count = used_count + 1
      where id = v_coupon_id;
    end if;

    insert into public.order_events (order_id, event, actor_id, data)
    values (
      v_order_id,
      'order_created',
      v_uid,
      jsonb_build_object(
        'subtotal', v_group_subtotal - v_discount,
        'discount', v_discount,
        'item_count', v_group_items
      )
    );

    -- Clear exactly the ordered lines for this supplier (unavailable lines
    -- stay in the cart so the buyer can see what did not go through).
    for i in 1 .. array_length(v_products, 1) loop
      if v_suppliers[i] = s then
        delete from public.cart_items
        where buyer_id = v_uid
          and product_id = v_products[i]
          and variant_id is not distinct from v_variants[i];
      end if;
    end loop;
    delete from public.cart_coupons where buyer_id = v_uid and supplier_id = s;

    v_orders := v_orders || jsonb_build_array(jsonb_build_object(
      'order_id', v_order_id,
      'supplier_id', s,
      'subtotal', v_group_subtotal - v_discount,
      'item_count', v_group_items
    ));
  end loop;

  insert into public.order_checkout_requests (buyer_id, key, order_ids)
  values (v_uid, p_idempotency_key, v_orders);

  return jsonb_build_object('orders', v_orders, 'duplicate', false, 'skipped', v_skipped);
end;
$$;

revoke execute on function public.create_orders_from_cart(jsonb, text, uuid) from public;
revoke execute on function public.create_orders_from_cart(jsonb, text, uuid) from anon;
grant execute on function public.create_orders_from_cart(jsonb, text, uuid) to authenticated;
