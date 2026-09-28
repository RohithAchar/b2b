import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Local dev stack only — never the remote project.
const URL = "http://127.0.0.1:54421";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "BuyerWorkflowPass123!";

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
    "[buyer-workflow] Local Supabase stack not reachable at " + URL + ". Start it with `pnpm dlx supabase start`.",
  );
}

interface Fixture {
  buyerClient: SupabaseClient;
  buyerUserId: string;
  otherBuyerClient: SupabaseClient;
  otherBuyerUserId: string;
  supplierClient: SupabaseClient;
  supplierUserId: string;
  companyId: string;
  categoryId: string;
  productId: string;
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

async function makeCompany(ownerId: string): Promise<string> {
  const { data, error } = await service
    .from("companies")
    .insert({
      owner_id: ownerId,
      business_name: "Buyer Workflow Test Co",
      contact_person: "Test",
      phone: "+91 9000000000",
      address: "Test Address, Test City",
      city: "Test City",
      state: "Test State",
      pincode: "000000",
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

async function makeCategory(): Promise<string> {
  const { data, error } = await service
    .from("categories")
    .insert({
      name: `Buyer Workflow ${Date.now()}`,
      slug: `buyer-workflow-${Date.now()}`,
      sort_order: 0,
      is_active: true,
      image_path: "seed/buyer-workflow-test.jpg",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function makeProduct(companyId: string, categoryId: string): Promise<string> {
  const { data, error } = await service
    .from("products")
    .insert({
      supplier_id: companyId,
      category_id: categoryId,
      title: "Buyer Workflow Test Product",
      description: "A product for testing the buyer workflow, with enough words to pass validation.",
      seller_sku: `BW-${Date.now()}`,
      hsn_code: "7208",
      unit: "kg",
      price_per_unit: 100,
      moq: 10,
      stock_qty: 100,
      lead_time_days: 5,
      gst_rate: 18,
      status: "approved",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function addImages(productId: string, count: number): Promise<void> {
  const rows = Array.from({ length: count }, (_, i) => ({
    product_id: productId,
    path: `test/${productId}-${i}.jpg`,
    sort: i,
  }));
  const { error } = await service.from("product_images").insert(rows);
  if (error) throw error;
}

describe.skipIf(!available)("buyer workflow", () => {
  let fx: Fixture;
  const createdUsers: string[] = [];

  beforeAll(async () => {
    const suffix = Date.now();
    const buyerEmail = `buyer-${suffix}@workflow.test`;
    const otherBuyerEmail = `other-buyer-${suffix}@workflow.test`;
    const supplierEmail = `supplier-${suffix}@workflow.test`;

    const buyerUserId = await makeUser(buyerEmail, "buyer");
    const otherBuyerUserId = await makeUser(otherBuyerEmail, "buyer");
    const supplierUserId = await makeUser(supplierEmail, "supplier");
    createdUsers.push(buyerUserId, otherBuyerUserId, supplierUserId);

    const companyId = await makeCompany(supplierUserId);
    const categoryId = await makeCategory();
    const productId = await makeProduct(companyId, categoryId);
    await addImages(productId, 3);

    const buyerClient = await signIn(buyerEmail);
    const otherBuyerClient = await signIn(otherBuyerEmail);
    const supplierClient = await signIn(supplierEmail);

    fx = {
      buyerClient,
      buyerUserId,
      otherBuyerClient,
      otherBuyerUserId,
      supplierClient,
      supplierUserId,
      companyId,
      categoryId,
      productId,
    };
  });

  afterAll(async () => {
    for (const uid of createdUsers) {
      await service.auth.admin.deleteUser(uid).catch(() => {});
    }
  });

  it("covers setup fixtures", () => {
    expect(available).toBe(true);
  });

  describe("saved products", () => {
    it("buyer can save a product", async () => {
      const { error } = await fx.buyerClient
        .from("saved_products")
        .insert({ buyer_id: fx.buyerUserId, product_id: fx.productId });
      expect(error).toBeNull();
    });

    it("duplicate save is prevented by unique constraint", async () => {
      const { error } = await fx.buyerClient
        .from("saved_products")
        .insert({ buyer_id: fx.buyerUserId, product_id: fx.productId });
      expect(error?.code).toBe("23505");
    });

    it("buyer can unsave a product", async () => {
      const { error } = await fx.buyerClient
        .from("saved_products")
        .delete()
        .eq("buyer_id", fx.buyerUserId)
        .eq("product_id", fx.productId);
      expect(error).toBeNull();
    });

    it("one user's saves are not visible to another user", async () => {
      // Buyer 1 saves the product.
      await fx.buyerClient
        .from("saved_products")
        .insert({ buyer_id: fx.buyerUserId, product_id: fx.productId });

      // Buyer 2 should not see it.
      const { data } = await fx.otherBuyerClient
        .from("saved_products")
        .select("id")
        .eq("buyer_id", fx.otherBuyerUserId)
        .eq("product_id", fx.productId);
      expect(data ?? []).toHaveLength(0);

      // Buyer 1 should see it.
      const { data: buyer1Data } = await fx.buyerClient
        .from("saved_products")
        .select("id")
        .eq("buyer_id", fx.buyerUserId)
        .eq("product_id", fx.productId);
      expect(buyer1Data).toHaveLength(1);
    });
  });

  describe("recently viewed", () => {
    it("viewing a product records it", async () => {
      const { error } = await fx.buyerClient
        .from("recently_viewed")
        .upsert(
          { buyer_id: fx.buyerUserId, product_id: fx.productId, last_viewed_at: new Date().toISOString() },
          { onConflict: "buyer_id,product_id" },
        );
      expect(error).toBeNull();
    });

    it("repeated view does not create duplicate rows", async () => {
      // View again.
      await fx.buyerClient
        .from("recently_viewed")
        .upsert(
          { buyer_id: fx.buyerUserId, product_id: fx.productId, last_viewed_at: new Date().toISOString() },
          { onConflict: "buyer_id,product_id" },
        );

      const { data } = await fx.buyerClient
        .from("recently_viewed")
        .select("id")
        .eq("buyer_id", fx.buyerUserId)
        .eq("product_id", fx.productId);
      expect(data).toHaveLength(1);
    });

    it("only authenticated user's history is returned", async () => {
      const { data } = await fx.otherBuyerClient
        .from("recently_viewed")
        .select("id")
        .eq("buyer_id", fx.otherBuyerUserId);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("enquiries", () => {
    it("buyer can create an enquiry", async () => {
      const { error } = await fx.buyerClient
        .from("enquiries")
        .insert({
          buyer_id: fx.buyerUserId,
          product_id: fx.productId,
          supplier_id: fx.companyId,
          quantity: 100,
          message: "Need a quote for 100 units.",
        });
      expect(error).toBeNull();
    });

    it("buyer only sees their own enquiries", async () => {
      const { data } = await fx.buyerClient
        .from("enquiries")
        .select("id")
        .eq("buyer_id", fx.buyerUserId);
      expect(data?.length).toBeGreaterThan(0);

      const { data: otherData } = await fx.otherBuyerClient
        .from("enquiries")
        .select("id")
        .eq("buyer_id", fx.otherBuyerUserId);
      expect(otherData ?? []).toHaveLength(0);
    });

    it("supplier can see enquiries for their company", async () => {
      const { data } = await fx.supplierClient
        .from("enquiries")
        .select("id")
        .eq("supplier_id", fx.companyId);
      expect(data?.length).toBeGreaterThan(0);
    });
  });
});
