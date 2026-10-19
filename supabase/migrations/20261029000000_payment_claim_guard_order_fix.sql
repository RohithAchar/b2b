-- Fix: recognize the buyer payment claim before the supplier-side branch.
--
-- 20261028000000 added the buyer claim to internal.guard_order_update, but the
-- claim branch lived inside `if not v_supplier_side`. A user who is both the
-- order's buyer AND a member (e.g. owner) of the selling company is classified
-- as supplier-side, so the claim branch was skipped and the update fell through
-- to the supplier transition matrix -> "Payment status cannot move from pending
-- to claimed".
--
-- The claim shape is now matched purely on `new.buyer_id = auth.uid()` and the
-- exact columns a claim may change, regardless of company membership. Supplier
-- transitions (including to 'paid') do not match this shape, so they are
-- unaffected.

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

  -- Payment claim (claim_order_payment): order status unchanged, payment
  -- moves to 'claimed' with a reference, and nothing the supplier owns is
  -- touched. Checked before the supplier branch so a buyer who also belongs to
  -- the selling company can still claim. A buyer can never reach 'paid'.
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

  v_supplier_side := internal.is_company_member(new.supplier_id);
  if not v_supplier_side then
    -- The only other buyer-side order write is the quote-rejection path
    -- performed by respond_to_quotation: status quoted -> new, nothing else
    -- touched, and only on their own order.
    if new.buyer_id = v_uid
       and old.status = 'quoted' and new.status = 'new'
       and new.payment_status is not distinct from old.payment_status
       and new.subtotal is not distinct from old.subtotal
       and new.delivery is not distinct from old.delivery
       and new.buyer_note is not distinct from old.buyer_note
       and new.supplier_note is not distinct from old.supplier_note then
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
