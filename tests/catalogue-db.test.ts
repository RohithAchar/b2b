import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeImageResultToken } from "../lib/ai/image-result-token";
import type { CatalogueFilters } from "../lib/catalogue";
import { getCataloguePage } from "../lib/storefront";

const URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const service = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const buyer = createClient(URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function probeLocal(): Promise<boolean> {
  try {
    const { error } = await service.from("categories").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

const available = await probeLocal();

if (!available) {
  console.log(
    "[catalogue-db] Local Supabase stack not reachable at " +
      URL +
      ". Start it with `pnpm dlx supabase start`.",
  );
}

function filters(overrides: Partial<CatalogueFilters> = {}): CatalogueFilters {
  return {
    query: "",
    categorySlug: "",
    sort: "newest",
    ...overrides,
  };
}

describe.skipIf(!available)("storefront catalogue", () => {
  const createdUsers: string[] = [];
  const createdCategories: string[] = [];

  let parentSlug = "";
  let childSlug = "";
  let otherSlug = "";
  let childId = "";

  let alphaId = "";
  let betaId = "";
  let gammaId = "";
  let otherId = "";
  let hiddenId = "";
  let draftId = "";
  let unverifiedId = "";

  async function createSupplier(
    suffix: string,
    status: "verified" | "draft",
  ): Promise<string> {
    const { data: userData, error: userError } = await service.auth.admin.createUser({
      email: `catalogue-${status}-${suffix}@db.test`,
      password: "CataloguePass123!",
      email_confirm: true,
    });
    if (userError) throw userError;
    const ownerId = userData.user.id;
    createdUsers.push(ownerId);

    await service.from("profiles").delete().eq("id", ownerId);
    const { error: profileError } = await service.from("profiles").insert({
      id: ownerId,
      email: `catalogue-${status}-${suffix}@db.test`,
      user_type: "supplier",
    });
    if (profileError) throw profileError;

    const { data: company, error: companyError } = await service
      .from("companies")
      .insert({
        owner_id: ownerId,
        business_name: `Catalogue ${status} ${suffix}`,
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
        margin_pct: 10,
        kyb_status: status,
        verified_at: status === "verified" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (companyError) throw companyError;
    return company.id as string;
  }

  async function createProduct(input: {
    supplierId: string;
    categoryId: string;
    title: string;
    price: number;
    moq: number;
    stock: number;
    createdAt: string;
    negotiable?: boolean;
    sampleAvailable?: boolean;
    status?: "approved" | "draft";
    hidden?: boolean;
  }): Promise<string> {
    const { data, error } = await service
      .from("products")
      .insert({
        supplier_id: input.supplierId,
        category_id: input.categoryId,
        title: input.title,
        description:
          "A catalogue fixture product with enough description text to satisfy the validation rule used by the product lifecycle.",
        seller_sku: `catalogue-${input.title.replace(/\s+/g, "-")}-${Date.now()}`,
        hsn_code: "5208",
        unit: "pcs",
        price_per_unit: input.price,
        moq: input.moq,
        stock_qty: input.stock,
        negotiable: input.negotiable ?? false,
        sample_available: input.sampleAvailable ?? false,
        lead_time_days: 5,
        gst_rate: 5,
        status: input.status ?? "approved",
        is_hidden: input.hidden ?? false,
        created_at: input.createdAt,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  beforeAll(async () => {
    const suffix = Date.now().toString(36);
    const verifiedSupplier = await createSupplier(suffix, "verified");
    const unverifiedSupplier = await createSupplier(suffix, "draft");

    parentSlug = `catalogue-parent-${suffix}`;
    childSlug = `catalogue-child-${suffix}`;
    otherSlug = `catalogue-other-${suffix}`;

    const { data: parent, error: parentError } = await service
      .from("categories")
      .insert({
        name: `Catalogue Parent ${suffix}`,
        slug: parentSlug,
        image_path: "seed/catalogue.jpg",
        sort_order: 1,
      })
      .select("id")
      .single();
    if (parentError) throw parentError;
    createdCategories.push(parent.id as string);

    const { data: child, error: childError } = await service
      .from("categories")
      .insert({
        name: `Catalogue Child ${suffix}`,
        slug: childSlug,
        parent_id: parent.id,
        image_path: "seed/catalogue.jpg",
        sort_order: 1,
      })
      .select("id")
      .single();
    if (childError) throw childError;
    childId = child.id as string;
    createdCategories.push(childId);

    const { data: other, error: otherError } = await service
      .from("categories")
      .insert({
        name: `Catalogue Other ${suffix}`,
        slug: otherSlug,
        image_path: "seed/catalogue.jpg",
        sort_order: 2,
      })
      .select("id")
      .single();
    if (otherError) throw otherError;
    createdCategories.push(other.id as string);

    alphaId = await createProduct({
      supplierId: verifiedSupplier,
      categoryId: childId,
      title: `Catalogue Alpha ${suffix}`,
      price: 100,
      moq: 10,
      stock: 5,
      negotiable: true,
      sampleAvailable: true,
      createdAt: "2026-01-04T00:00:00Z",
    });
    betaId = await createProduct({
      supplierId: verifiedSupplier,
      categoryId: parent.id as string,
      title: `Catalogue Beta ${suffix}`,
      price: 200,
      moq: 20,
      stock: 0,
      createdAt: "2026-01-03T00:00:00Z",
    });
    gammaId = await createProduct({
      supplierId: verifiedSupplier,
      categoryId: childId,
      title: `Catalogue Gamma ${suffix}`,
      price: 300,
      moq: 30,
      stock: 2,
      createdAt: "2026-01-02T00:00:00Z",
    });
    otherId = await createProduct({
      supplierId: verifiedSupplier,
      categoryId: other.id as string,
      title: `Catalogue Other ${suffix}`,
      price: 400,
      moq: 40,
      stock: 3,
      createdAt: "2026-01-01T00:00:00Z",
    });
    hiddenId = await createProduct({
      supplierId: verifiedSupplier,
      categoryId: childId,
      title: `Catalogue Hidden ${suffix}`,
      price: 50,
      moq: 1,
      stock: 10,
      hidden: true,
      createdAt: "2026-01-05T00:00:00Z",
    });
    draftId = await createProduct({
      supplierId: verifiedSupplier,
      categoryId: childId,
      title: `Catalogue Draft ${suffix}`,
      price: 50,
      moq: 1,
      stock: 10,
      status: "draft",
      createdAt: "2026-01-05T00:00:00Z",
    });
    unverifiedId = await createProduct({
      supplierId: unverifiedSupplier,
      categoryId: childId,
      title: `Catalogue Unverified ${suffix}`,
      price: 50,
      moq: 1,
      stock: 10,
      createdAt: "2026-01-05T00:00:00Z",
    });

    await service.from("product_images").insert({
      product_id: alphaId,
      path: `catalogue/${alphaId}.jpg`,
      sort: 0,
    });
  });

  afterAll(async () => {
    for (const uid of createdUsers) {
      await service.auth.admin.deleteUser(uid).catch(() => {});
    }
    for (const categoryId of createdCategories) {
      try {
        await service.from("categories").delete().eq("id", categoryId);
      } catch {
        continue;
      }
    }
  });

  it("returns only approved, visible products from verified suppliers", async () => {
    const page = await getCataloguePage(buyer, filters({ query: "Catalogue" }));
    const ids = page.items.map((item) => item.id);

    expect(ids).toContain(alphaId);
    expect(ids).toContain(betaId);
    expect(ids).toContain(gammaId);
    expect(ids).toContain(otherId);
    expect(ids).not.toContain(hiddenId);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(unverifiedId);
    expect(page.total).toBe(4);
  });

  it("includes child-category products when filtering by a parent", async () => {
    const page = await getCataloguePage(
      buyer,
      filters({ categorySlug: parentSlug }),
    );

    expect(page.items.map((item) => item.id).sort()).toEqual(
      [alphaId, betaId, gammaId].sort(),
    );
    expect(page.total).toBe(3);
  });

  it("applies price, MOQ, stock and flag filters", async () => {
    const byPrice = await getCataloguePage(
      buyer,
      filters({ minPrice: 200, maxPrice: 350 }),
    );
    expect(byPrice.items.map((item) => item.id).sort()).toEqual(
      [betaId, gammaId].sort(),
    );

    const byMoq = await getCataloguePage(buyer, filters({ minMoq: 20 }));
    expect(byMoq.items.map((item) => item.id).sort()).toEqual(
      [betaId, gammaId, otherId].sort(),
    );

    const inStock = await getCataloguePage(buyer, filters({ inStock: true }));
    expect(inStock.items.map((item) => item.id)).not.toContain(betaId);

    const flagged = await getCataloguePage(
      buyer,
      filters({ negotiable: true, sampleAvailable: true }),
    );
    expect(flagged.items.map((item) => item.id)).toEqual([alphaId]);
  });

  it("pages by price with a stable cursor and no duplicates", async () => {
    const first = await buyer.rpc("list_storefront_products", {
      p_query: "Catalogue",
      p_sort: "price_asc",
      p_limit: 2,
    });
    expect(first.error).toBeNull();
    const firstPage = first.data as {
      items: { id: string }[];
      nextCursor: { value: number; id: string };
      total: number;
    };

    expect(firstPage.items.map((item) => item.id)).toEqual([alphaId, betaId]);
    expect(firstPage.nextCursor.value).toBe(220);
    expect(firstPage.total).toBe(4);

    const second = await buyer.rpc("list_storefront_products", {
      p_query: "Catalogue",
      p_sort: "price_asc",
      p_limit: 2,
      p_cursor: firstPage.nextCursor,
    });
    expect(second.error).toBeNull();
    const secondPage = second.data as {
      items: { id: string }[];
      nextCursor: { value: number; id: string } | null;
      total: number;
    };

    expect(secondPage.items.map((item) => item.id)).toEqual([gammaId, otherId]);
    expect(secondPage.total).toBe(4);
    expect(new Set([...firstPage.items, ...secondPage.items].map((item) => item.id)).size).toBe(4);
  });

  it("keeps image-search rank while applying catalogue filters", async () => {
    const imageToken = encodeImageResultToken([otherId, gammaId, alphaId]);

    const page = await getCataloguePage(
      buyer,
      filters({ imageToken, sort: "relevance" }),
    );
    expect(page.items.map((item) => item.id)).toEqual([
      otherId,
      gammaId,
      alphaId,
    ]);

    const narrowed = await getCataloguePage(
      buyer,
      filters({ imageToken, sort: "relevance", maxPrice: 250 }),
    );
    expect(narrowed.items.map((item) => item.id)).toEqual([alphaId]);
  });

  it("counts only verified, visible products per category", async () => {
    const { data, error } = await buyer
      .from("category_product_counts")
      .select("category_id, product_count")
      .in("category_id", createdCategories);

    expect(error).toBeNull();
    const counts = new Map(
      (data ?? []).map((row) => [
        row.category_id as string,
        Number(row.product_count),
      ]),
    );

    const parentId = createdCategories[0];
    expect(counts.get(parentId)).toBe(3);
    expect(counts.get(childId)).toBe(2);
  });

  it("never exposes supplier base prices through the catalogue", async () => {
    const page = await getCataloguePage(buyer, filters({ query: "Catalogue" }));
    const serialized = JSON.stringify(page);

    expect(serialized).not.toContain("price_per_unit");
    expect(serialized).not.toContain("margin_pct");

    const { error } = await buyer
      .from("products")
      .select("price_per_unit")
      .limit(1);
    expect(error).not.toBeNull();
  });
});
