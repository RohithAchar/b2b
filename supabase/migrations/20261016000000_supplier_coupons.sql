-- Supplier coupons (Discounts page) + coupon attribution on orders.
--
-- Rule columns are intentionally narrow: percent/flat carry full pricing
-- rules validated by `validateCouponForOrder` in lib/supplier/coupons.ts;
-- buy_x_get_y / free_shipping / freebie / loyalty carry their headline
-- parameters and are eligibility-checked the same way, with fulfillment left
-- to the checkout flow. `is_active` is the redemption gate checkout checks.
--
-- `used_count` is maintained by the order-creation path (increment on
-- successful orders that carry `coupon_id`), not by triggers — buyers have
-- no UPDATE grant on this table. Reads of active coupons are open to
-- authenticated users so buyer-side checkout validation can run; codes are
-- shareable by design.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  type text not null
    constraint coupons_type_check
    check (type in ('percent', 'flat', 'buy_x_get_y', 'free_shipping', 'freebie', 'loyalty')),
  is_active boolean not null default true,
  -- Percent discount: percent_value (0,100], optional rupee cap.
  percent_value numeric,
  max_discount integer,
  -- Flat discount: flat_value rupees off.
  flat_value integer,
  -- Shared eligibility rules.
  min_order_value integer not null default 0
    constraint coupons_min_order_value_check check (min_order_value >= 0),
  usage_limit integer
    constraint coupons_usage_limit_check check (usage_limit is null or usage_limit >= 1),
  used_count integer not null default 0
    constraint coupons_used_count_check check (used_count >= 0),
  expires_at timestamptz,
  -- Buy X get Y: buy_quantity paid units earn get_quantity free (same order).
  buy_quantity integer
    constraint coupons_buy_quantity_check check (buy_quantity is null or buy_quantity >= 1),
  get_quantity integer
    constraint coupons_get_quantity_check check (get_quantity is null or get_quantity >= 1),
  -- Freebie: product given free when the minimum is met.
  free_product_id uuid references public.products (id) on delete set null,
  -- Loyalty: points awarded per redemption.
  loyalty_points integer
    constraint coupons_loyalty_points_check check (loyalty_points is null or loyalty_points >= 1),
  created_at timestamptz not null default now(),
  constraint coupons_code_supplier_unique unique (supplier_id, code),
  constraint coupons_percent_range_check
    check (percent_value is null or (percent_value > 0 and percent_value <= 100)),
  constraint coupons_nonnegative_amounts_check
    check (
      (max_discount is null or max_discount >= 0)
      and (flat_value is null or flat_value >= 0)
    )
);

create index coupons_supplier_idx on public.coupons (supplier_id);
create index coupons_supplier_active_idx on public.coupons (supplier_id, is_active);

alter table public.coupons enable row level security;

grant select, insert, update, delete on public.coupons to authenticated;
revoke all on public.coupons from anon;

-- Supplier: full access to their own coupons.
create policy "coupons_supplier_all"
  on public.coupons for all
  to authenticated
  using (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  )
  with check (
    supplier_id in (
      select id from public.companies where owner_id = ((select auth.uid()))
    )
  );

-- Any signed-in user may read ACTIVE coupons (buyer-side checkout
-- validation). Inactive, expired, or fully-redeemed coupons stay hidden;
-- finer eligibility is enforced in application code, not here.
create policy "coupons_select_active"
  on public.coupons for select
  to authenticated
  using (is_active);

create policy "coupons_admin_all"
  on public.coupons for all
  to authenticated
  using (internal.is_admin())
  with check (internal.is_admin());

-- Coupon attribution on orders ------------------------------------------------
alter table public.orders
  add column if not exists coupon_id uuid references public.coupons (id) on delete set null;

create index orders_coupon_idx on public.orders (coupon_id);

comment on column public.orders.coupon_id is
  'Redeemed coupon. Set once at order creation; used_count on the coupon is incremented by the same path.';
