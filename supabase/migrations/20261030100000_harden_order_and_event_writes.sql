-- Tighten client write paths around orders and analytics events.
--
-- Order creation, item snapshots and lifecycle changes already go through
-- SECURITY DEFINER RPCs or a guarded UPDATE. The remaining table grants let a
-- signed-in supplier insert/delete arbitrary order rows and order lines, which
-- bypasses the lifecycle and destroys financial history. Suppliers only need
-- to READ those tables directly; updates still go through the guard trigger.
--
-- Storefront events are written from server actions, not the browser. Once the
-- app uses the service-role client for that insert, anonymous/browser inserts
-- are no longer needed.

-- Orders: suppliers can read and update (guarded), never insert/delete.
revoke insert, delete, truncate on public.orders from authenticated;
grant select, update on public.orders to authenticated;

drop policy if exists "orders_supplier_all" on public.orders;
drop policy if exists "orders_supplier_select" on public.orders;
drop policy if exists "orders_supplier_update" on public.orders;

create policy "orders_supplier_select"
  on public.orders for select
  to authenticated
  using (internal.is_company_member(supplier_id));

create policy "orders_supplier_update"
  on public.orders for update
  to authenticated
  using (internal.is_company_member(supplier_id))
  with check (internal.is_company_member(supplier_id));

-- Order lines: read-only for every client role. Checkout/RPCs run as the
-- function owner.
revoke insert, update, delete, truncate on public.order_items from authenticated;
grant select on public.order_items to authenticated;

drop policy if exists "order_items_supplier_all" on public.order_items;
drop policy if exists "order_items_supplier_select" on public.order_items;

create policy "order_items_supplier_select"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and internal.is_company_member(o.supplier_id)
    )
  );

-- Storefront events: server-side inserts only. Reads stay supplier-scoped.
revoke insert, update, delete, truncate on public.storefront_events from anon, authenticated;
grant select on public.storefront_events to authenticated;

drop policy if exists "storefront_events_insert_any" on public.storefront_events;

-- Notification outbox: queueing and delivery are server-side. Clients only
-- read their order's trail; they must not be able to rewrite payloads or
-- statuses.
revoke insert, update, delete, truncate on public.notification_outbox from anon, authenticated;
grant select on public.notification_outbox to authenticated;

drop policy if exists "parties may queue notifications" on public.notification_outbox;
drop policy if exists "parties may update notification results" on public.notification_outbox;
