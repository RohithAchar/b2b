import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Local dev stack only — never the remote project. Start it with `pnpm dlx
// supabase start`. Tests skip with a hint when it is not reachable.
const URL = "http://127.0.0.1:54421";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "CheckoutPass123!";

const service = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function probeLocal(): Promise<boolean> {
  try {
    const { error } = await service.from("profiles").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

const available = await probeLocal();

if (!available) {
  console.log(
    "[checkout] Local Supabase stack not reachable at " +
      URL +
      ". Start it with `pnpm dlx supabase start`.",
  );
}

const DELIVERY = {
  fullName: "Checkout Buyer",
  phone: "9876543210",
  line1: "12 MG Road",
  line2: null,
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  instructions: null,
};

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function makeUser(email: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const uid = data.user.id;
  await service.from("profiles").delete().eq("id", uid);
  const { error: insError } = await service
    .from("profiles")
    .insert({ id: uid, email, user_type: "buyer" });
  if (insError) throw insError;
  return uid;
}

async function makeSupplierCompany(ownerName: string, suffix: number): Promise<string> {
  const { data: owner, error: ownerError } = await service.auth.admin.createUser({
    email: `checkout-supplier-${suffix}-${Date.now()}@checkout.test`,
    password: PASSWORD,
    email_confirm: true,
  });
  if (ownerError) throw ownerError;
  await service.from("profiles").delete().eq("id", owner.user.id);
  await service
    .from("profiles")
    .insert({ id: owner.user.id, email: `co-${suffix}@checkout.test`, user_type: "supplier" });
  const { data, error } = await service
    .from("companies")
    .insert({
      owner_id: owner.user.id,
      business_name: `Checkout Co ${ownerName} ${suffix}`,
      contact_person: "Test",
      phone: "+91 9000000000",
      address: "Test Address",
      city: "Test City",
      state: "Test State",
      pincode: "123456",
      gstin: "24AAAAA0000A1Z5",
      pan: "AAAAA0000A",
      bank_account: "00000000000",
      bank_ifsc: "SBIN0000000",
      kyb_status: "verified",
      verified_at: new Date().toISOString(),
      margin_pct: 10,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function makeProduct(companyId: string, suffix: number, overrides: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from("products")
    .insert({
      supplier_id: companyId,
      title: `Checkout Product ${suffix}`,
      description: "A product for checkout testing, with enough words to pass.",
      seller_sku: `CHK-${suffix}-${Date.now()}`,
      hsn_code: "7208",
      unit: "kg",
      price_per_unit: 100,
      moq: 1,
      stock_qty: 1000,
      lead_time_days: 5,
      gst_rate: 18,
      status: "approved",
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function addToCart(buyerId: string, productId: string, quantity: number) {
  const { error } = await service.from("cart_items").insert({
    buyer_id: buyerId,
    product_id: productId,
    variant_id: null,
    quantity,
  });
  if (error) throw error;
}

describe.skipIf(!available)("checkout order creation (DB)", () => {
  const createdUsers: string[] = [];
  let buyerClient: SupabaseClient;
  let buyerUserId: string;
  let companyA: string;
  let companyB: string;
  let productA: string;
  let productB: string;

  beforeAll(async () => {
    const suffix = Date.now();
    buyerUserId = await makeUser(`checkout-buyer-${suffix}@checkout.test`);
    createdUsers.push(buyerUserId);
    buyerClient = await signIn(`checkout-buyer-${suffix}@checkout.test`);

    companyA = await makeSupplierCompany("A", suffix);
    companyB = await makeSupplierCompany("B", suffix);
    productA = await makeProduct(companyA, suffix);
    productB = await makeProduct(companyB, suffix + 1);
  });

  afterAll(async () => {
    for (const uid of createdUsers) {
      await service.auth.admin.deleteUser(uid).catch(() => {});
    }
  });

  async function clearCart() {
    await service.from("cart_items").delete().eq("buyer_id", buyerUserId);
    await service.from("cart_coupons").delete().eq("buyer_id", buyerUserId);
  }

  async function cartCount(): Promise<number> {
    const { count } = await service
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyerUserId);
    return count ?? 0;
  }

  it("creates one order per supplier with server-computed prices", async () => {
    await clearCart();
    await addToCart(buyerUserId, productA, 10); // 10 × 110 = 1100
    await addToCart(buyerUserId, productB, 20); // 20 × 110 = 2200

    const { data, error } = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: DELIVERY,
      p_buyer_note: "Please deliver soon",
      p_idempotency_key: randomUUID(),
    });
    expect(error).toBeNull();
    const payload = data as { orders: { order_id: string; supplier_id: string }[]; duplicate: boolean };
    expect(payload.orders.length).toBe(2);
    expect(payload.duplicate).toBe(false);

    const supplierIds = payload.orders.map((o) => o.supplier_id).sort();
    expect(supplierIds).toEqual([companyA, companyB].sort());

    for (const created of payload.orders) {
      const { data: order } = await service
        .from("orders")
        .select("id, reference, status, payment_status, subtotal, item_count, delivery, buyer_note, region")
        .eq("id", created.order_id)
        .single();
      expect(order?.reference).toMatch(/^B2B-\d+$/);
      expect(order?.status).toBe("new");
      expect(order?.payment_status).toBe("not_requested");
      expect(order?.buyer_note).toBe("Please deliver soon");
      expect(order?.region).toBe("Karnataka");
      expect((order?.delivery as typeof DELIVERY).line1).toBe("12 MG Road");

      const { data: items } = await service
        .from("order_items")
        .select("title, unit, quantity, unit_price")
        .eq("order_id", created.order_id);
      expect(items?.length).toBe(1);
      expect(items?.[0]?.title).toContain("Checkout Product");
      expect(Number(items?.[0]?.unit_price)).toBe(110); // 100 + 10% margin
      expect(order?.item_count).toBe(items?.[0]?.quantity);
    }

    // Group A total is 1100 (below ₹2,500 on its own but allowed because the
    // cart-wide minimum is met) and group B is 2200.
    const totals = payload.orders
      .map((o) => o.supplier_id)
      .map((id) => id);
    expect(totals.length).toBe(2);
    const { data: orderA } = await service
      .from("orders")
      .select("subtotal")
      .eq("supplier_id", companyA)
      .eq("buyer_id", buyerUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(Number(orderA?.subtotal)).toBe(1100);

    // Ordered lines are cleared from the cart.
    expect(await cartCount()).toBe(0);

    // Buyers can read their own orders through RLS.
    const readable = await buyerClient.from("orders").select("id").in(
      "id",
      payload.orders.map((o) => o.order_id),
    );
    expect(readable.data?.length).toBe(2);
  });

  it("replays the same request id without creating duplicate orders", async () => {
    await clearCart();
    await addToCart(buyerUserId, productA, 30); // 3300
    const key = randomUUID();

    const first = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: DELIVERY,
      p_idempotency_key: key,
    });
    expect(first.error).toBeNull();
    const firstIds = (first.data as { orders: { order_id: string }[] }).orders.map(
      (o) => o.order_id,
    );

    const second = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: DELIVERY,
      p_idempotency_key: key,
    });
    expect(second.error).toBeNull();
    const secondPayload = second.data as { orders: { order_id: string }[]; duplicate: boolean };
    expect(secondPayload.duplicate).toBe(true);
    expect(secondPayload.orders.map((o) => o.order_id)).toEqual(firstIds);

    // No extra order rows were created for this buyer + product.
    const { data: orders } = await service
      .from("orders")
      .select("id")
      .eq("buyer_id", buyerUserId)
      .eq("supplier_id", companyA);
    expect((orders ?? []).filter((o) => firstIds.includes(o.id)).length).toBe(1);
  });

  it("rejects carts below the minimum order value", async () => {
    await clearCart();
    await addToCart(buyerUserId, productA, 1); // 110 < 2500
    const { error } = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: DELIVERY,
      p_idempotency_key: randomUUID(),
    });
    expect(error?.message).toContain("minimum order value");
    expect(await cartCount()).toBe(1); // cart untouched
  });

  it("rejects quantities below the MOQ", async () => {
    await clearCart();
    const strictProduct = await makeProduct(companyA, Date.now(), { moq: 50 });
    await addToCart(buyerUserId, strictProduct, 10);
    await addToCart(buyerUserId, productB, 30);
    const { error } = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: DELIVERY,
      p_idempotency_key: randomUUID(),
    });
    expect(error?.message).toContain("Minimum order quantity");
    expect(await cartCount()).toBe(2);
    await service.from("products").delete().eq("id", strictProduct);
  });

  it("rejects an invalid delivery snapshot", async () => {
    await clearCart();
    await addToCart(buyerUserId, productA, 30);
    const { error } = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: { ...DELIVERY, phone: "12345" },
      p_idempotency_key: randomUUID(),
    });
    expect(error?.message).toContain("phone");
    expect(await cartCount()).toBe(1);
  });

  it("ignores unorderable products and leaves them in the cart", async () => {
    await clearCart();
    const hiddenProduct = await makeProduct(companyA, Date.now(), { is_hidden: true });
    await addToCart(buyerUserId, hiddenProduct, 30);
    await addToCart(buyerUserId, productB, 30);

    const { data, error } = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: DELIVERY,
      p_idempotency_key: randomUUID(),
    });
    expect(error).toBeNull();
    const payload = data as { orders: { supplier_id: string }[]; skipped: number };
    expect(payload.skipped).toBe(1);
    expect(payload.orders.length).toBe(1);
    expect(payload.orders[0].supplier_id).toBe(productB ? companyB : "");

    // The hidden line survives in the cart for the buyer to see.
    const { data: remaining } = await service
      .from("cart_items")
      .select("product_id")
      .eq("buyer_id", buyerUserId);
    expect((remaining ?? []).map((r) => r.product_id)).toEqual([hiddenProduct]);
    await service.from("products").delete().eq("id", hiddenProduct);
  });

  it("applies a percent coupon and records it on the order", async () => {
    await clearCart();
    await addToCart(buyerUserId, productA, 30); // 3300, 10% = 330 off

    const { data: coupon, error: couponError } = await service
      .from("coupons")
      .insert({
        supplier_id: companyA,
        code: `CHK${Date.now()}`,
        type: "percent",
        percent_value: 10,
        min_order_value: 0,
        is_active: true,
      })
      .select("id, code, used_count")
      .single();
    expect(couponError).toBeNull();
    const createdCoupon = coupon!;

    await service.from("cart_coupons").insert({
      buyer_id: buyerUserId,
      supplier_id: companyA,
      code: createdCoupon.code,
    });

    const { error } = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: DELIVERY,
      p_idempotency_key: randomUUID(),
    });
    expect(error).toBeNull();

    const { data: order } = await service
      .from("orders")
      .select("subtotal, discount, coupon_id")
      .eq("buyer_id", buyerUserId)
      .eq("supplier_id", companyA)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(Number(order?.discount)).toBe(330);
    expect(Number(order?.subtotal)).toBe(2970);
    expect(order?.coupon_id).toBe(createdCoupon.id);

    const { data: refreshed } = await service
      .from("coupons")
      .select("used_count")
      .eq("id", createdCoupon.id)
      .single();
    expect(refreshed?.used_count).toBe((createdCoupon.used_count ?? 0) + 1);

    await service.from("coupons").delete().eq("id", createdCoupon.id);
  });

  it("cannot be called with forged financial arguments", async () => {
    await clearCart();
    await addToCart(buyerUserId, productA, 30);
    // The RPC accepts no price/total parameters at all; an attempt to pass
    // one is rejected by the API schema before any code runs.
    const { error } = await buyerClient.rpc("create_orders_from_cart", {
      p_delivery: DELIVERY,
      p_idempotency_key: randomUUID(),
      p_subtotal: 1,
    } as never);
    expect(error).not.toBeNull();
    await clearCart();
  });
});
