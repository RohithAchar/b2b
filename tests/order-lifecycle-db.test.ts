import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Local dev stack only — never the remote project. Start it with `pnpm dlx
// supabase start`. Tests skip with a hint when it is not reachable.
const URL = "http://127.0.0.1:54421";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "OrderLifecyclePass123!";

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
    "[order-lifecycle] Local Supabase stack not reachable at " +
      URL +
      ". Start it with `pnpm dlx supabase start`.",
  );
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function makeUser(email: string, userType: "buyer" | "supplier"): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const uid = data.user.id;
  await service.from("profiles").delete().eq("id", uid);
  const { error: insError } = await service.from("profiles").insert({
    id: uid,
    email,
    user_type: userType,
  });
  if (insError) throw insError;
  return uid;
}

async function makeCompany(ownerId: string, name: string): Promise<string> {
  const { data, error } = await service
    .from("companies")
    .insert({
      owner_id: ownerId,
      business_name: name,
      contact_person: "Test",
      phone: "+91 9000000000",
      address: "Test Address, Test City",
      city: "Test City",
      state: "Test State",
      pincode: "123456",
      gstin: "24AAAAA0000A1Z5",
      pan: "AAAAA0000A",
      bank_account: "00000000000",
      bank_ifsc: "SBIN0000000",
      kyb_status: "verified",
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const deliverySnapshot = {
  fullName: "Test Buyer",
  phone: "9876543210",
  line1: "12 MG Road",
  line2: "Sector 14",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  instructions: "Call before delivery",
};

async function makeOrder(
  supplierId: string,
  buyerId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await service
    .from("orders")
    .insert({
      supplier_id: supplierId,
      buyer_id: buyerId,
      status: "new",
      subtotal: 1250.5,
      item_count: 3,
      delivery: deliverySnapshot,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe.skipIf(!available)("order lifecycle (DB)", () => {
  const createdUsers: string[] = [];
  let buyerClient: SupabaseClient;
  let buyerUserId: string;
  let strangerClient: SupabaseClient;
  let strangerUserId: string;
  let supplierClient: SupabaseClient;
  let supplierUserId: string;
  let companyId: string;
  let otherSupplierClient: SupabaseClient;
  let otherSupplierUserId: string;
  let staffClient: SupabaseClient;
  let staffUserId: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    buyerUserId = await makeUser(`ol-buyer-${suffix}@order.test`, "buyer");
    strangerUserId = await makeUser(`ol-stranger-${suffix}@order.test`, "buyer");
    supplierUserId = await makeUser(`ol-supplier-${suffix}@order.test`, "supplier");
    otherSupplierUserId = await makeUser(`ol-other-${suffix}@order.test`, "supplier");
    staffUserId = await makeUser(`ol-staff-${suffix}@order.test`, "buyer");
    createdUsers.push(buyerUserId, strangerUserId, supplierUserId, otherSupplierUserId, staffUserId);

    companyId = await makeCompany(supplierUserId, "OL Supplier Co");
    await makeCompany(otherSupplierUserId, "OL Other Co");

    const { error: memberError } = await service.from("company_members").insert({
      company_id: companyId,
      user_id: staffUserId,
      email: `ol-staff-${suffix}@order.test`,
    });
    if (memberError) throw memberError;

    const { data: product, error: productError } = await service
      .from("products")
      .insert({
        supplier_id: companyId,
        title: "OL Test Product",
        description: "A product for order lifecycle testing, with enough words.",
        seller_sku: `OL-${suffix}`,
        hsn_code: "7208",
        unit: "kg",
        price_per_unit: 100,
        moq: 1,
        stock_qty: 100,
        lead_time_days: 5,
        gst_rate: 18,
        status: "approved",
      })
      .select("id")
      .single();
    if (productError) throw productError;
    productId = product.id as string;

    buyerClient = await signIn(`ol-buyer-${suffix}@order.test`);
    strangerClient = await signIn(`ol-stranger-${suffix}@order.test`);
    supplierClient = await signIn(`ol-supplier-${suffix}@order.test`);
    otherSupplierClient = await signIn(`ol-other-${suffix}@order.test`);
    staffClient = await signIn(`ol-staff-${suffix}@order.test`);

    orderId = await makeOrder(companyId, buyerUserId);
  });

  afterAll(async () => {
    for (const uid of createdUsers) {
      await service.auth.admin.deleteUser(uid).catch(() => {});
    }
  });

  it("assigns a B2B- reference and defaults payment status", async () => {
    const { data } = await service
      .from("orders")
      .select("reference, payment_status, status")
      .eq("id", orderId)
      .single();
    expect(data?.reference).toMatch(/^B2B-\d{5,}$/);
    expect(data?.payment_status).toBe("not_requested");
    expect(data?.status).toBe("new");
  });

  it("accepts fractional (paise) subtotals", async () => {
    const id = await makeOrder(companyId, buyerUserId, { subtotal: 99.99 });
    const { data } = await service.from("orders").select("subtotal").eq("id", id).single();
    expect(Number(data?.subtotal)).toBeCloseTo(99.99);
  });

  it("rejects unknown status values", async () => {
    const { error } = await service.from("orders").insert({
      supplier_id: companyId,
      buyer_id: buyerUserId,
      status: "bogus",
      subtotal: 100,
      item_count: 1,
    });
    expect(error).not.toBeNull();
  });

  it("fills order item snapshots from the product row", async () => {
    const { data: item, error } = await service
      .from("order_items")
      .insert({
        order_id: orderId,
        product_id: productId,
        variant_id: null,
        quantity: 2,
        unit_price: 100,
      })
      .select("title, unit")
      .single();
    expect(error).toBeNull();
    expect(item?.title).toBe("OL Test Product");
    expect(item?.unit).toBe("kg");
  });

  it("lets the owning supplier and their staff read the order, not others", async () => {
    const owner = await supplierClient.from("orders").select("id").eq("id", orderId);
    expect(owner.data?.length).toBe(1);

    const staff = await staffClient.from("orders").select("id").eq("id", orderId);
    expect(staff.data?.length).toBe(1);

    const other = await otherSupplierClient.from("orders").select("id").eq("id", orderId);
    expect(other.data?.length ?? 0).toBe(0);

    const buyer = await buyerClient.from("orders").select("id").eq("id", orderId);
    expect(buyer.data?.length).toBe(1);
  });

  it("blocks buyers from inserting orders directly", async () => {
    const { data, error } = await buyerClient
      .from("orders")
      .insert({
        supplier_id: companyId,
        buyer_id: buyerUserId,
        status: "confirmed",
        subtotal: 1,
        item_count: 1,
      })
      .select("id");
    expect(error).not.toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it("blocks buyers from updating an order (status or subtotal)", async () => {
    await buyerClient
      .from("orders")
      .update({ status: "delivered", subtotal: 1 })
      .eq("id", orderId);
    const { data } = await service
      .from("orders")
      .select("status, subtotal")
      .eq("id", orderId)
      .single();
    expect(data?.status).toBe("new");
    expect(Number(data?.subtotal)).toBe(1250.5);
  });

  it("allows the supplier to confirm the order and logs an event", async () => {
    const { error } = await supplierClient
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId);
    expect(error).toBeNull();
    const { data } = await service
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expect(data?.status).toBe("confirmed");

    const { data: events } = await service
      .from("order_events")
      .select("event, data")
      .eq("order_id", orderId)
      .eq("event", "status_changed");
    expect(
      (events ?? []).some((e) => e.data?.from === "new" && e.data?.to === "confirmed"),
    ).toBe(true);
  });

  it("rejects invalid status transitions on the server", async () => {
    const { error } = await supplierClient
      .from("orders")
      .update({ status: "new" })
      .eq("id", orderId);
    expect(error?.message).toContain("cannot move from confirmed to new");
  });

  it("blocks other suppliers from updating the order", async () => {
    await otherSupplierClient
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);
    const { data } = await service
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expect(data?.status).toBe("confirmed");
  });

  it("records payment confirmation actor and timestamp for the supplier", async () => {
    const { error } = await supplierClient
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", orderId);
    expect(error).toBeNull();
    const { data } = await service
      .from("orders")
      .select("payment_status, payment_confirmed_by, payment_confirmed_at")
      .eq("id", orderId)
      .single();
    expect(data?.payment_status).toBe("paid");
    expect(data?.payment_confirmed_by).toBe(supplierUserId);
    expect(data?.payment_confirmed_at).not.toBeNull();
  });

  it("prevents the supplier from editing money or the delivery snapshot", async () => {
    const bad = await supplierClient
      .from("orders")
      .update({ subtotal: 1, delivery: { ...deliverySnapshot, line1: "Hacked" } })
      .eq("id", orderId);
    expect(bad.error?.message).toContain("cannot be changed");
    const { data } = await service
      .from("orders")
      .select("subtotal, delivery")
      .eq("id", orderId)
      .single();
    expect(Number(data?.subtotal)).toBe(1250.5);
    expect((data?.delivery as { line1: string }).line1).toBe("12 MG Road");
  });

  describe("quotations", () => {
    let quotationId: string;

    it("stores a quote with server-checked totals", async () => {
      const { data, error } = await service
        .from("quotations")
        .insert({
          order_id: orderId,
          version: 1,
          subtotal: 1200,
          delivery_charge: 100,
          tax_amount: 50,
          total: 1350,
          created_by: supplierUserId,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      quotationId = (data as { id: string }).id;
    });

    it("rejects quotes whose total does not add up", async () => {
      const { error } = await service.from("quotations").insert({
        order_id: orderId,
        version: 2,
        subtotal: 1200,
        delivery_charge: 100,
        tax_amount: 50,
        total: 9999,
        created_by: supplierUserId,
      });
      expect(error).not.toBeNull();
    });

    it("is readable by the owning buyer and supplier, not by strangers", async () => {
      const buyer = await buyerClient.from("quotations").select("id").eq("id", quotationId);
      expect(buyer.data?.length).toBe(1);

      const supplier = await supplierClient.from("quotations").select("id").eq("id", quotationId);
      expect(supplier.data?.length).toBe(1);

      const staff = await staffClient.from("quotations").select("id").eq("id", quotationId);
      expect(staff.data?.length).toBe(1);

      const other = await otherSupplierClient.from("quotations").select("id").eq("id", quotationId);
      expect(other.data?.length ?? 0).toBe(0);

      const stranger = await strangerClient.from("quotations").select("id").eq("id", quotationId);
      expect(stranger.data?.length ?? 0).toBe(0);
    });

    it("blocks clients from writing quotes directly (RPC-only writes)", async () => {
      const { error } = await supplierClient.from("quotations").insert({
        order_id: orderId,
        version: 3,
        subtotal: 100,
        total: 100,
        created_by: supplierUserId,
      });
      expect(error).not.toBeNull();
    });

    it("only allows one accepted quote per order", async () => {
      await service
        .from("quotations")
        .update({ status: "accepted", accepted_by: buyerUserId, accepted_at: new Date().toISOString() })
        .eq("id", quotationId);
      const { error } = await service
        .from("quotations")
        .insert({
          order_id: orderId,
          version: 2,
          subtotal: 500,
          total: 500,
          status: "accepted",
          created_by: supplierUserId,
        });
      expect(error).not.toBeNull();
    });
  });

  describe("buyer addresses", () => {
    let addressId: string;

    it("saves a valid address for the buyer", async () => {
      const { data, error } = await buyerClient
        .from("buyer_addresses")
        .insert({
          buyer_id: buyerUserId,
          full_name: "Test Buyer",
          phone: "9876543210",
          line1: "12 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          is_default: true,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      addressId = (data as { id: string }).id;
    });

    it("rejects invalid phone numbers and PIN codes", async () => {
      const badPhone = await buyerClient.from("buyer_addresses").insert({
        buyer_id: buyerUserId,
        full_name: "Test Buyer",
        phone: "12345",
        line1: "12 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      });
      expect(badPhone.error).not.toBeNull();

      const badPin = await buyerClient.from("buyer_addresses").insert({
        buyer_id: buyerUserId,
        full_name: "Test Buyer",
        phone: "9876543210",
        line1: "12 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "012345",
      });
      expect(badPin.error).not.toBeNull();
    });

    it("hides addresses from other buyers", async () => {
      const rows = await strangerClient.from("buyer_addresses").select("id");
      expect(rows.data?.length ?? 0).toBe(0);
    });

    it("allows the owner to edit their address", async () => {
      const { error } = await buyerClient
        .from("buyer_addresses")
        .update({ line2: "Updated" })
        .eq("id", addressId);
      expect(error).toBeNull();
    });

    it("allows only one default address per buyer", async () => {
      const { error } = await buyerClient.from("buyer_addresses").insert({
        buyer_id: buyerUserId,
        full_name: "Test Buyer",
        phone: "9812345678",
        line1: "42 Residency Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560025",
        is_default: true,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("supplier fulfilment actions (DB)", () => {
    let fulfilOrderId: string;

    beforeAll(async () => {
      fulfilOrderId = await makeOrder(companyId, buyerUserId, { status: "new" });
    });

    it("lets staff of the owning company act on the order", async () => {
      const { error } = await staffClient
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", fulfilOrderId);
      expect(error).toBeNull();
      const { data } = await service
        .from("orders")
        .select("status")
        .eq("id", fulfilOrderId)
        .single();
      expect(data?.status).toBe("confirmed");
    });

    it("records rejection reason and stage timestamps", async () => {
      const rejectOrderId = await makeOrder(companyId, buyerUserId, { status: "new" });
      const { error } = await supplierClient
        .from("orders")
        .update({
          status: "cancelled",
          rejection_reason: "Out of stock for two weeks.",
          rejected_at: new Date().toISOString(),
        })
        .eq("id", rejectOrderId);
      expect(error).toBeNull();

      const { data } = await service
        .from("orders")
        .select("status, rejection_reason, rejected_at, cancelled_at")
        .eq("id", rejectOrderId)
        .single();
      expect(data?.status).toBe("cancelled");
      expect(data?.rejection_reason).toBe("Out of stock for two weeks.");
      expect(data?.rejected_at).not.toBeNull();
      expect(data?.cancelled_at).not.toBeNull();

      const { data: events } = await service
        .from("order_events")
        .select("event, data")
        .eq("order_id", rejectOrderId)
        .eq("event", "order_cancelled");
      expect((events ?? []).length).toBe(1);
      expect(events?.[0]?.data?.reason).toBe("Out of stock for two weeks.");
    });

    it("persists shipment details and stamps shipped_at", async () => {
      await supplierClient
        .from("orders")
        .update({ status: "processing" })
        .eq("id", fulfilOrderId);
      const { error } = await supplierClient
        .from("orders")
        .update({
          status: "shipped",
          carrier: "Delhivery",
          tracking_ref: "DLV123456",
          shipment_notes: "Packed in two boxes.",
        })
        .eq("id", fulfilOrderId);
      expect(error).toBeNull();

      const { data } = await service
        .from("orders")
        .select("status, carrier, tracking_ref, shipment_notes, shipped_at")
        .eq("id", fulfilOrderId)
        .single();
      expect(data?.status).toBe("shipped");
      expect(data?.carrier).toBe("Delhivery");
      expect(data?.tracking_ref).toBe("DLV123456");
      expect(data?.shipment_notes).toBe("Packed in two boxes.");
      expect(data?.shipped_at).not.toBeNull();
    });

    it("blocks moving a shipped order backwards", async () => {
      const { error } = await supplierClient
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", fulfilOrderId);
      expect(error?.message).toContain("cannot move from shipped to confirmed");
    });
  });

  describe("order events", () => {
    it("are visible to the buyer and hidden from strangers", async () => {
      const buyer = await buyerClient.from("order_events").select("id").eq("order_id", orderId);
      expect((buyer.data?.length ?? 0) > 0).toBe(true);

      const stranger = await strangerClient
        .from("order_events")
        .select("id")
        .eq("order_id", orderId);
      expect(stranger.data?.length ?? 0).toBe(0);
    });

    it("cannot be written by clients", async () => {
      const { error } = await supplierClient.from("order_events").insert({
        order_id: orderId,
        event: "forged",
      });
      expect(error).not.toBeNull();
    });
  });
});
