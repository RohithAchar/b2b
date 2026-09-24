import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { plainTextLength } from "../lib/supplier/rich-text";

// Local dev stack only — never the remote project. Start it with `pnpm dlx
// supabase start` (ports override in supabase/config.toml when another stack
// occupies the defaults). Tests skip with a hint when it is not reachable.
const URL = "http://127.0.0.1:54421";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "LifecyclePass123!";

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
    "[lifecycle] Local Supabase stack not reachable at " + URL + ". Start it with `pnpm dlx supabase start`.",
  );
}

interface Fixture {
  adminClient: SupabaseClient;
  adminUserId: string;
  supplierClient: SupabaseClient;
  supplierUserId: string;
  companyId: string;
  categoryId: string;
  unverifiedClient: SupabaseClient;
  unverifiedCompanyId: string;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function makeUser(email: string, userType: "admin" | "supplier"): Promise<string> {
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

async function makeCompany(ownerId: string, kybStatus: string): Promise<string> {
  const { data, error } = await service
    .from("companies")
    .insert({
      owner_id: ownerId,
      business_name: "Lifecycle Test Co",
      contact_person: "Test",
      phone: "+91 9000000000",
      address: "Test Address, Test City",
      city: "Test",
      state: "Test",
      pincode: "000000",
      gstin: "24AAAAA0000A1Z5",
      pan: "AAAAA0000A",
      bank_account: "00000000000",
      bank_ifsc: "SBIN0000000",
      kyb_status: kybStatus,
      verified_at: kybStatus === "verified" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function makeCategory(isActive: boolean): Promise<string> {
  const { data, error } = await service
    .from("categories")
    .insert({
      name: `Lifecycle ${isActive ? "Active" : "Inactive"} ${Date.now()}`,
      slug: `lifecycle-${isActive ? "active" : "inactive"}-${Date.now()}`,
      sort_order: 0,
      is_active: isActive,
      image_path: "seed/lifecycle-test.jpg",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function makeProduct(
  companyId: string,
  categoryId: string,
  sku: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await service
    .from("products")
    .insert({
      supplier_id: companyId,
      category_id: categoryId,
      title: overrides.title ?? "Lifecycle Cotton Fabric 100 GSM",
      description:
        overrides.description ??
        "A fabric used to verify the lifecycle state machine, with enough words to pass the fifty character minimum check.",
      seller_sku: sku,
      hsn_code: overrides.hsn_code ?? "5208",
      unit: "mtr",
      price_per_unit: 100,
      moq: 10,
      stock_qty: 100,
      lead_time_days: 5,
      gst_rate: 5,
      status: overrides.status ?? "draft",
      submitted_at: overrides.submitted_at ?? null,
      reviewed_by: overrides.reviewed_by ?? null,
      rejection_note: overrides.rejection_note ?? null,
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

async function readStatus(adminClient: SupabaseClient, productId: string) {
  const { data } = await adminClient.from("products").select("status").eq("id", productId).maybeSingle();
  return data?.status as string | undefined;
}

async function productMeta(adminClient: SupabaseClient, productId: string) {
  const { data } = await adminClient
    .from("products")
    .select("status, reviewed_by, reviewed_at, rejection_note, submitted_at")
    .eq("id", productId)
    .maybeSingle();
  return data as
    | { status: string; reviewed_by: string | null; reviewed_at: string | null; rejection_note: string | null; submitted_at: string | null }
    | null;
}

async function auditFor(productId: string) {
  const { data } = await service
    .from("audit_logs")
    .select("actor_id, action, old_status, new_status")
    .eq("entity_id", productId)
    .eq("entity_type", "product")
    .order("created_at", { ascending: true });
  return (data ?? []) as { actor_id: string | null; action: string; old_status: string; new_status: string }[];
}

describe.skipIf(!available)("product lifecycle hardening", () => {
  let fx: Fixture;
  let seq = 0;
  const createdUsers: string[] = [];

  beforeAll(async () => {
    const suffix = Date.now();
    const adminEmail = `admin-${suffix}@lifecycle.test`;
    const supplierEmail = `supplier-${suffix}@lifecycle.test`;
    const unverifiedEmail = `unverified-${suffix}@lifecycle.test`;

    const adminUserId = await makeUser(adminEmail, "admin");
    const supplierUserId = await makeUser(supplierEmail, "supplier");
    const unverifiedUserId = await makeUser(unverifiedEmail, "supplier");
    createdUsers.push(adminUserId, supplierUserId, unverifiedUserId);

    const companyId = await makeCompany(supplierUserId, "verified");
    const unverifiedCompanyId = await makeCompany(unverifiedUserId, "draft");

    const adminClient = await signIn(adminEmail);
    const supplierClient = await signIn(supplierEmail);
    const unverifiedClient = await signIn(unverifiedEmail);

    const categoryId = await makeCategory(true);

    fx = {
      adminClient,
      adminUserId,
      supplierClient,
      supplierUserId,
      companyId,
      unverifiedClient,
      unverifiedCompanyId,
      categoryId,
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

  describe("allowed transitions", () => {
    it("draft -> pending via submit_product_for_approval", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-ALLOW-${++seq}-P`);
      await addImages(pid, 3);
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect(error).toBeNull();
      const meta = await productMeta(fx.adminClient, pid);
      expect(meta?.status).toBe("pending");
      expect(meta?.submitted_at).not.toBeNull();
      expect(meta?.rejection_note).toBeNull();
    });

    it("pending -> approved via approve_product", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-ALLOW-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      const { error } = await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      expect(error).toBeNull();
      const meta = await productMeta(fx.adminClient, pid);
      expect(meta?.status).toBe("approved");
      expect(meta?.reviewed_by).toBe(fx.adminUserId);
      expect(meta?.reviewed_at).not.toBeNull();
    });

    it("pending -> rejected via reject_product, then rejected -> pending resubmit", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-ALLOW-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      const { error: rejErr } = await fx.adminClient.rpc("reject_product", {
        p_product_id: pid,
        p_note: "Please fix the images before resubmitting.",
      });
      expect(rejErr).toBeNull();
      const rejMeta = await productMeta(fx.adminClient, pid);
      expect(rejMeta?.status).toBe("rejected");
      expect(rejMeta?.reviewed_by).toBe(fx.adminUserId);
      expect(rejMeta?.rejection_note).toContain("images");

      const { error: resubErr } = await fx.supplierClient.rpc("submit_product_for_approval", {
        p_product_id: pid,
      });
      expect(resubErr).toBeNull();
      const meta = await productMeta(fx.adminClient, pid);
      expect(meta?.status).toBe("pending");
      expect(meta?.rejection_note).toBeNull();
      expect(meta?.reviewed_by).toBeNull();
      expect(meta?.reviewed_at).toBeNull();
    });
  });

  describe("forbidden transitions", () => {
    it("draft -> approved is blocked", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-FO-${++seq}-P`);
      const { error } = await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      expect(error?.message).toContain("not pending");
      expect(await readStatus(fx.adminClient, pid)).toBe("draft");
    });

    it("draft -> rejected is blocked", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-FO-${++seq}-P`);
      const { error } = await fx.adminClient.rpc("reject_product", {
        p_product_id: pid,
        p_note: "This should not be allowed on a draft.",
      });
      expect(error?.message).toContain("not pending");
      expect(await readStatus(fx.adminClient, pid)).toBe("draft");
    });

    it("pending -> pending (double submit) is blocked", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-FO-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect(error?.message).toContain("submittable state");
      expect(await readStatus(fx.adminClient, pid)).toBe("pending");
    });

    it("approved -> pending is blocked", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-FO-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect(error?.message).toContain("submittable state");
      expect(await readStatus(fx.adminClient, pid)).toBe("approved");
    });

    it("approved -> rejected is blocked", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-FO-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      const { error } = await fx.adminClient.rpc("reject_product", {
        p_product_id: pid,
        p_note: "Approved products cannot be rejected directly.",
      });
      expect(error?.message).toContain("not pending");
      expect(await readStatus(fx.adminClient, pid)).toBe("approved");
    });

    it("rejected -> approved (skip resubmission) is blocked", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-FO-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("reject_product", {
        p_product_id: pid,
        p_note: "A rejected product must be resubmitted before it can be approved.",
      });
      const { error } = await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      expect(error?.message).toContain("not pending");
      expect(await readStatus(fx.adminClient, pid)).toBe("rejected");
    });
  });

  describe("supplier cannot touch approval metadata", () => {
    it("direct status UPDATE is blocked by the guard trigger", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-GUARD-${++seq}-P`);
      const { error } = await fx.supplierClient
        .from("products")
        .update({ status: "pending" })
        .eq("id", pid);
      expect(error?.message).toContain("administrator");
      expect(await readStatus(fx.adminClient, pid)).toBe("draft");
    });

    it("direct reviewed_by UPDATE is blocked by the guard trigger", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-GUARD-${++seq}-P`);
      const { error } = await fx.supplierClient
        .from("products")
        .update({ reviewed_by: fx.adminUserId })
        .eq("id", pid);
      expect(error?.message).toContain("administrator");
    });

    it("direct rejection_note UPDATE is blocked by the guard trigger", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-GUARD-${++seq}-P`);
      const { error } = await fx.supplierClient
        .from("products")
        .update({ rejection_note: "self approved" })
        .eq("id", pid);
      expect(error?.message).toContain("administrator");
    });
  });

  describe("approval-time completeness validation", () => {
    it("incomplete product (no images) cannot be submitted", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-VAL-${++seq}-P`);
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect((error?.message ?? "").toLowerCase()).toContain("images");
      expect(await readStatus(fx.adminClient, pid)).toBe("draft");
    });

    it("unverified supplier cannot submit", async () => {
      const pid = await makeProduct(fx.unverifiedCompanyId, fx.categoryId, `LK-VAL-${++seq}-P`);
      await addImages(pid, 3);
      const { error } = await fx.unverifiedClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect(error?.message).toContain("verified");
    });

    it("submit still enforces content rules that RLS does not (title too short)", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-VAL-${++seq}-P`, {
        title: "Short",
      });
      await addImages(pid, 3);
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect(error?.message).toContain("title");
      expect(await readStatus(fx.adminClient, pid)).toBe("draft");
    });

    it("inactive category blocks submit", async () => {
      const inactiveCategoryId = await makeCategory(false);
      const pid = await makeProduct(fx.companyId, inactiveCategoryId, `LK-VAL-${++seq}-P`);
      await addImages(pid, 3);
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect(error?.message).toContain("active");
    });

    it("approve runs the validator even when the record is pending (images removed after submit)", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-VAL-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      const { error: delErr } = await service.from("product_images").delete().eq("product_id", pid);
      expect(delErr).toBeNull();
      const { error } = await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      expect((error?.message ?? "").toLowerCase()).toContain("images");
      expect(await readStatus(fx.adminClient, pid)).toBe("pending");
    });

    it("submit counts visible text and rejects a tag-only description", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-VAL-${++seq}-P`, {
        description: "<p><strong>&nbsp;</strong></p>",
      });
      await addImages(pid, 3);
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect((error?.message ?? "").toLowerCase()).toContain("description");
      expect(await readStatus(fx.adminClient, pid)).toBe("draft");
    });

    it("submit accepts rich HTML when the visible text clears the minimum", async () => {
      const html =
        "<p>Wholesale cotton fabric rolls in plain weave, ideal for premium school</p>" +
        "<p>uniform collections.</p>";
      expect(plainTextLength(html)).toBeGreaterThanOrEqual(50);
      expect(html.length).toBeGreaterThan(plainTextLength(html));
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-VAL-${++seq}-P`, {
        description: html,
      });
      await addImages(pid, 3);
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      expect(error).toBeNull();
      expect(await readStatus(fx.adminClient, pid)).toBe("pending");
    });
  });

  describe("audit logging actor", () => {
    it("records the supplier as actor on submit", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-AUDIT-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      const logs = await auditFor(pid);
      expect(logs.some((l) => l.action === "status_change" && l.new_status === "pending")).toBe(true);
      const submitLog = logs.find((l) => l.new_status === "pending");
      expect(submitLog?.actor_id).toBe(fx.supplierUserId);
      expect(submitLog?.old_status).toBe("draft");
    });

    it("records the admin as actor on approve", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-AUDIT-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      const logs = await auditFor(pid);
      const approvedLog = logs.find((l) => l.new_status === "approved");
      expect(approvedLog?.actor_id).toBe(fx.adminUserId);
      expect(approvedLog?.old_status).toBe("pending");
    });

    it("records the admin as actor on reject", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-AUDIT-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("reject_product", {
        p_product_id: pid,
        p_note: "Rejected for the audit actor test.",
      });
      const logs = await auditFor(pid);
      const rejectedLog = logs.find((l) => l.new_status === "rejected");
      expect(rejectedLog?.actor_id).toBe(fx.adminUserId);
    });
  });

  describe("variant SKU uniqueness", () => {
    it("variant SKU matching the product SKU is rejected", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-SKU-PROD-${++seq}`);
      const { error } = await fx.supplierClient.rpc("replace_product_variants", {
        p_product_id: pid,
        p_variants: [
          {
            label: "Bad",
            attrs: {},
            seller_sku: `LK-SKU-PROD-${seq}`,
            price: 10,
            moq: 1,
            stock_qty: 1,
          },
        ],
      });
      expect(error?.message).toContain("product SKU");
    });

    it("duplicate variant SKUs within a product are rejected", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-SKU-DUP-${++seq}`);
      const { error } = await fx.supplierClient.rpc("replace_product_variants", {
        p_product_id: pid,
        p_variants: [
          { label: "Red", attrs: {}, seller_sku: "LK-VAR-A1", price: 10, moq: 1, stock_qty: 1 },
          { label: "Blue", attrs: {}, seller_sku: "LK-VAR-A1", price: 11, moq: 1, stock_qty: 1 },
        ],
      });
      expect(error?.message).toContain("duplicate");
    });

    it("variant SKU colliding with another product of the same supplier is rejected", async () => {
      const baseSku = `LK-SKU-COLL-${++seq}`;
      const pid = await makeProduct(fx.companyId, fx.categoryId, baseSku);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("approve_product", { p_product_id: pid });

      const otherPid = await makeProduct(fx.companyId, fx.categoryId, `LK-SKU-OTHER-${++seq}`);
      await addImages(otherPid, 3);
      const { error } = await fx.supplierClient.rpc("replace_product_variants", {
        p_product_id: otherPid,
        p_variants: [
          {
            label: "Clash",
            attrs: {},
            seller_sku: baseSku,
            price: 10,
            moq: 1,
            stock_qty: 1,
          },
        ],
      });
      expect(error?.message).toBeTruthy();
    });
  });

  describe("replace_product_images", () => {
    it("rejects more than 8 image rows atomically (existing rows kept)", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-IMG-${++seq}-P`);
      await addImages(pid, 2);
      const paths = Array.from({ length: 10 }, (_, i) => `test/${pid}-x${i}.jpg`);
      const { error } = await fx.supplierClient.rpc("replace_product_images", {
        p_product_id: pid,
        p_paths: paths,
      });
      expect(error?.message).toContain("8");
      const { count } = await service
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", pid);
      expect(count).toBe(2);
    });

    it("replaces images on approved products (live edits)", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-IMG-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      const { error } = await fx.supplierClient.rpc("replace_product_images", {
        p_product_id: pid,
        p_paths: ["test/a.jpg", "test/b.jpg"],
      });
      expect(error).toBeNull();
      const { count } = await service
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", pid);
      expect(count).toBe(2);
    });
  });

  describe("KYB state machine alignment", () => {
    it("approve_kyb on a rejected company is blocked", async () => {
      const email = `kyb-rejected-${Date.now()}@lifecycle.test`;
      const uid = await makeUser(email, "supplier");
      createdUsers.push(uid);
      const companyId = await makeCompany(uid, "rejected");
      const { error } = await fx.adminClient.rpc("approve_kyb", { p_company_id: companyId });
      expect(error?.message).toContain("pending");
    });

    it("rejected company can resubmit to pending before approval", async () => {
      const email = `kyb-resubmit-${Date.now()}@lifecycle.test`;
      const uid = await makeUser(email, "supplier");
      createdUsers.push(uid);
      const companyId = await makeCompany(uid, "rejected");
      const client = await signIn(email);
      const { error: subErr } = await client.rpc("submit_kyb", { p_company_id: companyId });
      expect(subErr).toBeNull();
      const { data } = await service.from("companies").select("kyb_status").eq("id", companyId).maybeSingle();
      expect((data as { kyb_status: string }).kyb_status).toBe("pending");
      const { error: appErr } = await fx.adminClient.rpc("approve_kyb", { p_company_id: companyId });
      expect(appErr).toBeNull();
    });

    it("draft KYB company submits to pending, then admin verifies", async () => {
      const email = `kyb-draft-${Date.now()}@lifecycle.test`;
      const uid = await makeUser(email, "supplier");
      createdUsers.push(uid);
      const companyId = await makeCompany(uid, "draft");
      const client = await signIn(email);
      const { error: subErr } = await client.rpc("submit_kyb", { p_company_id: companyId });
      expect(subErr).toBeNull();
      const { error: appErr } = await fx.adminClient.rpc("approve_kyb", { p_company_id: companyId });
      expect(appErr).toBeNull();
    });
  });

  describe("product SEO fields", () => {
    it("supplier persists seo title, description and image path on a draft", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-SEO-${++seq}-P`);
      const { error } = await fx.supplierClient
        .from("products")
        .update({
          seo_title: "Keyword School Uniform Socks",
          seo_description:
            "Wholesale cotton school socks from a verified Indian manufacturer, MOQ 10 pairs.",
          seo_image_path: `test/${pid}/seo/cover.jpg`,
        })
        .eq("id", pid);
      expect(error).toBeNull();
      const { data } = await service
        .from("products")
        .select("seo_title, seo_description, seo_image_path")
        .eq("id", pid)
        .maybeSingle();
      expect(data).toMatchObject({
        seo_title: "Keyword School Uniform Socks",
        seo_description:
          "Wholesale cotton school socks from a verified Indian manufacturer, MOQ 10 pairs.",
        seo_image_path: `test/${pid}/seo/cover.jpg`,
      });
    });

    it("supplier can clear the seo image path back to null", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-SEO-${++seq}-P`);
      await fx.supplierClient
        .from("products")
        .update({ seo_image_path: `test/${pid}/seo/old.jpg` })
        .eq("id", pid);
      const { error } = await fx.supplierClient
        .from("products")
        .update({ seo_image_path: null })
        .eq("id", pid);
      expect(error).toBeNull();
      const { data } = await service
        .from("products")
        .select("seo_image_path")
        .eq("id", pid)
        .maybeSingle();
      expect((data as { seo_image_path: string | null }).seo_image_path).toBeNull();
    });

    it("another verified supplier cannot change someone else's seo fields", async () => {
      const email = `seo-other-${Date.now()}@lifecycle.test`;
      const uid = await makeUser(email, "supplier");
      createdUsers.push(uid);
      const otherCompanyId = await makeCompany(uid, "verified");
      const pid = await makeProduct(otherCompanyId, fx.categoryId, `LK-SEO-${++seq}-P`);
      const { error } = await fx.supplierClient
        .from("products")
        .update({ seo_title: "Should not be allowed" })
        .eq("id", pid);
      expect(error).not.toBeNull();
    });

    it("seo image path never satisfies the gallery minimum for submission", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-SEO-${++seq}-P`);
      await fx.supplierClient
        .from("products")
        .update({ seo_image_path: `test/${pid}/seo/cover.jpg` })
        .eq("id", pid);
      const { error } = await fx.supplierClient.rpc("submit_product_for_approval", {
        p_product_id: pid,
      });
      expect((error?.message ?? "").toLowerCase()).toContain("images");
      expect(await readStatus(fx.adminClient, pid)).toBe("draft");
    });

    it("supplier can edit seo fields on an approved product (stays approved)", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-SEO-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      const { error } = await fx.supplierClient
        .from("products")
        .update({ seo_title: "Late edit" })
        .eq("id", pid);
      expect(error).toBeNull();
      const { data } = await service
        .from("products")
        .select("seo_title, status")
        .eq("id", pid)
        .maybeSingle();
      expect(data).toMatchObject({ seo_title: "Late edit", status: "approved" });
    });
  });

  describe("live product editing, hide/show and admin take-down", () => {
    const anon = createClient(URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    async function makeLiveProduct(prefix: string): Promise<string> {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `${prefix}-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      return pid;
    }

    async function readHidden(productId: string) {
      const { data } = await service
        .from("products")
        .select("is_hidden")
        .eq("id", productId)
        .maybeSingle();
      return (data as { is_hidden: boolean } | null)?.is_hidden ?? null;
    }

    it("supplier edits an approved product in place (status stays approved)", async () => {
      const pid = await makeLiveProduct("LK-LIVE-EDIT");
      const { error } = await fx.supplierClient
        .from("products")
        .update({ title: "Edited live title", price_per_unit: 125 })
        .eq("id", pid);
      expect(error).toBeNull();
      const { data } = await service
        .from("products")
        .select("status, title, price_per_unit")
        .eq("id", pid)
        .maybeSingle();
      expect(data).toMatchObject({
        status: "approved",
        title: "Edited live title",
        price_per_unit: 125,
      });
    });

    it("supplier can replace variants on an approved product", async () => {
      const pid = await makeLiveProduct("LK-LIVE-VAR");
      const { error } = await fx.supplierClient.rpc("replace_product_variants", {
        p_product_id: pid,
        p_variants: [
          { label: "Red", attrs: {}, seller_sku: "LK-VAR-NEW1", price: 11, moq: 1, stock_qty: 5 },
        ],
      });
      expect(error).toBeNull();
      const { count } = await service
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("product_id", pid);
      expect(count).toBe(1);
    });

    it("guard still blocks the supplier from changing status on an approved product", async () => {
      const pid = await makeLiveProduct("LK-LIVE-GUARD");
      const { error } = await fx.supplierClient
        .from("products")
        .update({ status: "pending" })
        .eq("id", pid);
      expect(error?.message).toContain("administrator");
      expect(await readStatus(fx.adminClient, pid)).toBe("approved");
    });

    it("pending products still cannot be edited", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-LIVE-PEND-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      const { data, error } = await fx.supplierClient
        .from("products")
        .update({ title: "Should fail" })
        .eq("id", pid)
        .select("id");
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);
      const { data: row } = await service
        .from("products")
        .select("title")
        .eq("id", pid)
        .maybeSingle();
      expect((row as { title: string }).title).not.toBe("Should fail");
    });

    it("supplier hides an approved product and it leaves the public storefront", async () => {
      const pid = await makeLiveProduct("LK-HIDE");
      const { error } = await fx.supplierClient
        .from("products")
        .update({ is_hidden: true })
        .eq("id", pid);
      expect(error).toBeNull();
      expect(await readHidden(pid)).toBe(true);
      const { data: anonData } = await anon
        .from("products")
        .select("id")
        .eq("id", pid)
        .eq("status", "approved")
        .maybeSingle();
      expect(anonData).toBeNull();
    });

    it("supplier can show a hidden product again", async () => {
      const pid = await makeLiveProduct("LK-UNHIDE");
      await fx.supplierClient.from("products").update({ is_hidden: true }).eq("id", pid);
      const { error } = await fx.supplierClient
        .from("products")
        .update({ is_hidden: false })
        .eq("id", pid);
      expect(error).toBeNull();
      expect(await readHidden(pid)).toBe(false);
      const { data } = await anon
        .from("products")
        .select("id")
        .eq("id", pid)
        .eq("status", "approved")
        .maybeSingle();
      expect(data?.id).toBe(pid);
    });

    it("admin takes down a live product to draft", async () => {
      const pid = await makeLiveProduct("LK-TAKEDOWN");
      const { error } = await fx.adminClient.rpc("unpublish_product", { p_product_id: pid });
      expect(error).toBeNull();
      expect(await readStatus(fx.adminClient, pid)).toBe("draft");
      const { data: anonData } = await anon
        .from("products")
        .select("id")
        .eq("id", pid)
        .eq("status", "approved")
        .maybeSingle();
      expect(anonData).toBeNull();
    });

    it("taken-down product can be re-edited, resubmitted and re-approved", async () => {
      const pid = await makeLiveProduct("LK-RELIST");
      await fx.adminClient.rpc("unpublish_product", { p_product_id: pid });
      const { error: editErr } = await fx.supplierClient
        .from("products")
        .update({ title: "Relisted after take-down" })
        .eq("id", pid);
      expect(editErr).toBeNull();
      const { error: subErr } = await fx.supplierClient.rpc("submit_product_for_approval", {
        p_product_id: pid,
      });
      expect(subErr).toBeNull();
      const { error: appErr } = await fx.adminClient.rpc("approve_product", { p_product_id: pid });
      expect(appErr).toBeNull();
      expect(await readStatus(fx.adminClient, pid)).toBe("approved");
    });

    it("unpublish only works on approved products", async () => {
      const pid = await makeProduct(fx.companyId, fx.categoryId, `LK-TD-BAD-${++seq}-P`);
      await addImages(pid, 3);
      await fx.supplierClient.rpc("submit_product_for_approval", { p_product_id: pid });
      const { error } = await fx.adminClient.rpc("unpublish_product", { p_product_id: pid });
      expect(error?.message).toContain("not live");
      expect(await readStatus(fx.adminClient, pid)).toBe("pending");
    });

    it("unpublish is admin-only", async () => {
      const pid = await makeLiveProduct("LK-TD-ADMIN");
      const { error } = await fx.supplierClient.rpc("unpublish_product", { p_product_id: pid });
      expect(error?.message).toContain("Admin only");
      expect(await readStatus(fx.adminClient, pid)).toBe("approved");
    });
  });
});