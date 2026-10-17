-- Order lifecycle foundations: data model for checkout, quotations, payment
-- confirmation and audit history — plus the security hardening that must land
-- before any checkout code writes real orders.
--
-- Conventions follow the existing repo pattern (see
-- 20260916110000_security_state_machine_enforcement.sql): SECURITY DEFINER
-- functions gated on auth.uid(), guard triggers for immutability and state
-- machines, RLS row policies for reads.
--
-- Status vocabulary keeps the existing `orders.status` values (`new`,
-- `confirmed`, `shipped`, `delivered`, `cancelled` are already used by the
-- supplier dashboard and analytics) and adds `quoted` and `processing`.
-- `pending_supplier` from the spec maps to the existing `new`.
--
-- Money: product prices are numeric(12,2) (paise-precise) but orders stored
-- integer rupees, which would silently truncate real prices. Both money
-- columns move to numeric(12,2). Existing integer data casts losslessly.

-- =============================================================================
-- 1. Helpers ===================================================================
-- =============================================================================

-- True when the caller is the company owner or an accepted staff member.
-- Single source of truth for supplier-side authorization in policies,
-- triggers and RPCs. SECURITY DEFINER so it is not blocked by the
-- owner-only companies policies.
create or replace function internal.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and (
        c.owner_id = (select auth.uid())
        or exists (
          select 1 from public.company_members m
          where m.company_id = c.id and m.user_id = (select auth.uid())
        )
      )
  )
$$;

grant execute on function internal.is_company_member(uuid) to authenticated;

-- =============================================================================
-- 2. Order event history (append-only) =========================================
-- =============================================================================

-- Written only by SECURITY DEFINER functions/triggers below; clients get
-- SELECT through ownership policies and no write grants at all.
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  event text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;

grant select on public.order_events to authenticated;
revoke all on public.order_events from anon;

create policy "order_events_select_buyer"
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.buyer_id = ((select auth.uid()))
    )
  );

create policy "order_events_select_supplier"
  on public.order_events for select
  to authenticated
  using (
    internal.is_company_member(
      (select supplier_id from public.orders where id = order_events.order_id)
    )
  );

create policy "order_events_select_admin"
  on public.order_events for select
  to authenticated
  using (internal.is_admin());

-- =============================================================================
-- 3. Orders: lifecycle columns =================================================
-- =============================================================================

alter table public.orders
  add column if not exists reference text,
  add column if not exists payment_status text not null default 'not_requested',
  add column if not exists payment_confirmed_by uuid references public.profiles (id) on delete set null,
  add column if not exists payment_confirmed_at timestamptz,
  -- Immutable delivery-address snapshot captured at checkout (see
  -- lib/orders/lifecycle.ts for the validated shape).
  add column if not exists delivery jsonb,
  add column if not exists buyer_note text,
  add column if not exists supplier_note text,
  add column if not exists rejection_reason text,
  add column if not exists rejected_at timestamptz,
  add column if not exists carrier text,
  add column if not exists tracking_ref text,
  add column if not exists shipment_notes text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz;

-- Status lifecycle: existing values plus `quoted` and `processing`.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('new', 'quoted', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('not_requested', 'pending', 'paid'));

-- Paise-precise money (was integer rupees).
alter table public.orders alter column subtotal type numeric(12, 2);
alter table public.orders drop constraint if exists orders_subtotal_check;
alter table public.orders
  add constraint orders_subtotal_check check (subtotal >= 0);

-- Order reference: B2B-###### from a sequence, assigned by trigger. Padding
-- is 6 because the sequence starts at 100001 (lpad truncates longer values).
create sequence if not exists public.order_reference_seq start 100001;

update public.orders
set reference = 'B2B-' || lpad(nextval('public.order_reference_seq')::text, 6, '0')
where reference is null
order by created_at;

alter table public.orders alter column reference set not null;
alter table public.orders drop constraint if exists orders_reference_unique;
alter table public.orders
  add constraint orders_reference_unique unique (reference);

create or replace function internal.assign_order_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'B2B-' || lpad(nextval('public.order_reference_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists assign_order_reference on public.orders;
create trigger assign_order_reference
  before insert on public.orders
  for each row execute function internal.assign_order_reference();

-- updated_at maintenance (existing helper from the product lifecycle migration).
drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function internal.set_updated_at();

-- =============================================================================
-- 4. Order items: price type + immutable snapshots =============================
-- =============================================================================

alter table public.order_items alter column unit_price type numeric(12, 2);

alter table public.order_items
  add column if not exists title text,
  add column if not exists variant_label text,
  add column if not exists unit text;

-- Backfill snapshots for existing rows from the live product records.
update public.order_items oi
set title = coalesce(p.title, ''),
    unit = coalesce(p.unit, ''),
    variant_label = v.label
from public.products p
left join public.product_variants v on v.id = oi.variant_id
where p.id = oi.product_id
  and (oi.title is null or oi.unit is null);

alter table public.order_items alter column title set default '';
alter table public.order_items alter column title set not null;
alter table public.order_items alter column unit set default '';
alter table public.order_items alter column unit set not null;

-- Future inserts (seed scripts, service tooling) get snapshots filled from
-- the live product row whenever the writer did not provide them, so historical
-- order lines never depend on a product's current name or price.
create or replace function internal.fill_order_item_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
begin
  select * into v_product from public.products where id = new.product_id;
  if not found then
    raise exception 'Product % not found', new.product_id;
  end if;
  if new.variant_id is not null then
    select * into v_variant
    from public.product_variants
    where id = new.variant_id and product_id = new.product_id;
    if not found then
      raise exception 'Variant % does not belong to product %', new.variant_id, new.product_id;
    end if;
  end if;
  if new.title is null or new.title = '' then
    new.title := v_product.title;
  end if;
  if new.unit is null or new.unit = '' then
    new.unit := v_product.unit;
  end if;
  if new.variant_id is not null and (new.variant_label is null or new.variant_label = '') then
    new.variant_label := v_variant.label;
  end if;
  return new;
end;
$$;

drop trigger if exists fill_order_item_snapshot on public.order_items;
create trigger fill_order_item_snapshot
  before insert on public.order_items
  for each row execute function internal.fill_order_item_snapshot();

-- =============================================================================
-- 5. Client write access tightening ============================================
-- =============================================================================

-- Order creation becomes a server-validated RPC (Phase 3). Buyers must not be
-- able to INSERT orders or items directly with arbitrary totals or suppliers.
drop policy if exists "orders_buyer_insert_own" on public.orders;
drop policy if exists "order_items_buyer_insert_own" on public.order_items;

-- Supplier-side policies: include staff (company_members), not just the owner.
drop policy if exists "orders_supplier_all" on public.orders;
create policy "orders_supplier_all"
  on public.orders for all
  to authenticated
  using (internal.is_company_member(supplier_id))
  with check (internal.is_company_member(supplier_id));

drop policy if exists "order_items_supplier_all" on public.order_items;
create policy "order_items_supplier_all"
  on public.order_items for all
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and internal.is_company_member(o.supplier_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and internal.is_company_member(o.supplier_id)
    )
  );

-- Supplier read policy on order events (staff included) — created in section 2.

-- =============================================================================
-- 6. Order guard trigger: immutability + state machine =========================
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
    -- Buyers never edit orders directly (quote responses go through RPCs);
    -- RLS already blocks this, this is defense in depth.
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
  if new.payment_status is distinct from old.payment_status then
    if not exists (
      select 1 from (values
        ('not_requested', 'pending'),
        ('not_requested', 'paid'),
        ('pending', 'paid')
      ) as t(from_status, to_status)
      where t.from_status = old.payment_status and t.to_status = new.payment_status
    ) then
      raise exception 'Payment status cannot move from % to %', old.payment_status, new.payment_status;
    end if;

    if new.payment_status = 'paid' then
      -- Record who confirmed receipt and when. Never derived from a buyer
      -- action; only a supplier-side actor reaches this branch.
      new.payment_confirmed_by := v_uid;
      new.payment_confirmed_at := now();
    else
      new.payment_confirmed_by := null;
      new.payment_confirmed_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_order_update on public.orders;
create trigger guard_order_update
  before update on public.orders
  for each row execute function internal.guard_order_update();

-- =============================================================================
-- 7. Order audit trigger -> order_events =======================================
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
        'confirmed_by', new.payment_confirmed_by
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

drop trigger if exists audit_order_change on public.orders;
create trigger audit_order_change
  after update on public.orders
  for each row execute function internal.audit_order_change();

-- =============================================================================
-- 8. Buyer delivery addresses ===================================================
-- =============================================================================

create table public.buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  -- Indian mobile number, 10 digits, first digit 6-9 (same rule as
  -- lib/user-phone.ts and the KYB form).
  phone text not null
    constraint buyer_addresses_phone_check check (phone ~ '^[6-9][0-9]{9}$'),
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  -- PIN codes never start with 0.
  pincode text not null
    constraint buyer_addresses_pincode_check check (pincode ~ '^[1-9][0-9]{5}$'),
  instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buyer_addresses_buyer_idx on public.buyer_addresses (buyer_id, created_at desc);
-- At most one default address per buyer.
create unique index buyer_addresses_one_default_idx
  on public.buyer_addresses (buyer_id) where is_default;

alter table public.buyer_addresses enable row level security;

grant select, insert, update, delete on public.buyer_addresses to authenticated;
revoke all on public.buyer_addresses from anon;

create policy "buyer_addresses_select_own"
  on public.buyer_addresses for select
  to authenticated
  using (buyer_id = ((select auth.uid())));

create policy "buyer_addresses_insert_own"
  on public.buyer_addresses for insert
  to authenticated
  with check (buyer_id = ((select auth.uid())));

create policy "buyer_addresses_update_own"
  on public.buyer_addresses for update
  to authenticated
  using (buyer_id = ((select auth.uid())))
  with check (buyer_id = ((select auth.uid())));

create policy "buyer_addresses_delete_own"
  on public.buyer_addresses for delete
  to authenticated
  using (buyer_id = ((select auth.uid())));

create policy "buyer_addresses_admin_all"
  on public.buyer_addresses for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

drop trigger if exists set_buyer_addresses_updated_at on public.buyer_addresses;
create trigger set_buyer_addresses_updated_at
  before update on public.buyer_addresses
  for each row execute function internal.set_updated_at();

-- =============================================================================
-- 9. Quotations =================================================================
-- =============================================================================

-- One row per quote version; revisions append, they never overwrite. Totals
-- are computed server-side (RPC, Phase 5) and double-checked here.
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  version integer not null default 1
    constraint quotations_version_check check (version >= 1),
  status text not null default 'sent'
    constraint quotations_status_check check (status in ('sent', 'accepted', 'rejected', 'expired')),
  subtotal numeric(12, 2) not null default 0
    constraint quotations_subtotal_check check (subtotal >= 0),
  delivery_charge numeric(12, 2) not null default 0
    constraint quotations_delivery_charge_check check (delivery_charge >= 0),
  tax_amount numeric(12, 2) not null default 0
    constraint quotations_tax_amount_check check (tax_amount >= 0),
  total numeric(12, 2) not null default 0
    constraint quotations_total_check check (total >= 0),
  note text,
  expires_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Total must equal its parts; prevents hand-written rows from drifting.
  constraint quotations_total_math_check
    check (total = subtotal + delivery_charge + tax_amount),
  constraint quotations_order_version_unique unique (order_id, version)
);

-- A quote can only be accepted via the buyer RPC, which also stamps
-- accepted_by/accepted_at; this index keeps "one accepted quote per order"
-- true even under concurrent requests.
create unique index quotations_one_accepted_idx
  on public.quotations (order_id) where status = 'accepted';

create index quotations_order_idx on public.quotations (order_id, created_at);

alter table public.quotations enable row level security;

-- Reads only: all writes go through SECURITY DEFINER RPCs (Phase 5).
grant select on public.quotations to authenticated;
revoke all on public.quotations from anon;

create policy "quotations_select_buyer"
  on public.quotations for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = quotations.order_id and o.buyer_id = ((select auth.uid()))
    )
  );

create policy "quotations_select_supplier"
  on public.quotations for select
  to authenticated
  using (
    internal.is_company_member(
      (select supplier_id from public.orders where id = quotations.order_id)
    )
  );

create policy "quotations_select_admin"
  on public.quotations for select
  to authenticated
  using (internal.is_admin());

drop trigger if exists set_quotations_updated_at on public.quotations;
create trigger set_quotations_updated_at
  before update on public.quotations
  for each row execute function internal.set_updated_at();

-- Line items of a quote: snapshots plus the link back to the original order
-- line, so a revision can never distort what was originally ordered.
create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete set null,
  title text not null,
  variant_label text,
  unit text not null default '',
  quantity integer not null
    constraint quotation_items_quantity_check check (quantity >= 1),
  unit_price numeric(12, 2) not null
    constraint quotation_items_unit_price_check check (unit_price >= 0),
  line_total numeric(12, 2) not null
    constraint quotation_items_line_total_check check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint quotation_items_line_total_math_check
    check (line_total = round(unit_price * quantity, 2))
);

create index quotation_items_quotation_idx on public.quotation_items (quotation_id);

alter table public.quotation_items enable row level security;

grant select on public.quotation_items to authenticated;
revoke all on public.quotation_items from anon;

create policy "quotation_items_select_buyer"
  on public.quotation_items for select
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      join public.orders o on o.id = q.order_id
      where q.id = quotation_items.quotation_id
        and o.buyer_id = ((select auth.uid()))
    )
  );

create policy "quotation_items_select_supplier"
  on public.quotation_items for select
  to authenticated
  using (
    exists (
      select 1 from public.quotations q
      join public.orders o on o.id = q.order_id
      where q.id = quotation_items.quotation_id
        and internal.is_company_member(o.supplier_id)
    )
  );

create policy "quotation_items_select_admin"
  on public.quotation_items for select
  to authenticated
  using (internal.is_admin());
