"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupplierContext } from "@/lib/auth/guard";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  mapCustomerCsvRows,
  parseCustomerCsv,
  validateCustomerRow,
  type ImportOutcome,
} from "@/lib/supplier/customers";

const BASE = "/supplier/dashboard/audience";

export type CustomerActionState = {
  ok: boolean;
  message: string;
};

const errState = (message: string): CustomerActionState => ({ ok: false, message });

async function supplierCompanyId(
  supplierClient: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supplierClient.auth.getUser();
  if (!user) return null;
  const ctx = await getSupplierContext(supplierClient, user.id);
  return ctx?.companyId ?? null;
}

/** Manually add one customer (source: manual). Redirects on success, which
 * closes the dialog and refreshes the list. */
export async function addCustomer(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState | never> {
  const validated = validateCustomerRow({
    name: (formData.get("name")?.toString() ?? ""),
    phone: (formData.get("phone")?.toString() ?? ""),
    email: (formData.get("email")?.toString() ?? ""),
    city: (formData.get("city")?.toString() ?? ""),
  });
  if (!validated.ok) {
    return errState(validated.message);
  }

  const supabase = await createClient();
  const companyId = await supplierCompanyId(supabase);
  if (!companyId) {
    return errState("You must be signed in as a supplier.");
  }

  const { error } = await supabase.from("store_customers").insert({
    supplier_id: companyId,
    name: validated.value.name,
    phone: validated.value.phone,
    email: validated.value.email ?? null,
    city: validated.value.city ?? null,
    source: "manual",
  });
  if (error) {
    console.error("addCustomer failed:", error.code, error.message);
    return errState("Could not add the customer. Try again.");
  }

  revalidatePath(BASE);
  redirect(BASE);
}

export type ImportActionState = CustomerActionState & Partial<ImportOutcome>;

const MAX_IMPORT_BYTES = 512 * 1024;
const MAX_IMPORT_ROWS = 2000;

/** Bulk import from a CSV file (name, phone, email, city). Exact phone/email
 * matches against existing records or earlier file rows are skipped as
 * duplicates and reported, never merged. */
export async function importCustomers(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...errState("Choose a CSV file to import."), imported: 0, skippedDuplicates: 0, invalid: [] };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { ...errState("File is too large (512 KB max)."), imported: 0, skippedDuplicates: 0, invalid: [] };
  }

  const supabase = await createClient();
  const companyId = await supplierCompanyId(supabase);
  if (!companyId) {
    return { ...errState("You must be signed in as a supplier."), imported: 0, skippedDuplicates: 0, invalid: [] };
  }

  const text = await file.text();
  const mapped = mapCustomerCsvRows(parseCustomerCsv(text)).slice(0, MAX_IMPORT_ROWS);

  const existing = await fetchAllRows<{ phone: string; email: string | null }>(
    "Customer import duplicates",
    (offset, limit) =>
      supabase
        .from("store_customers")
        .select("phone, email")
        .eq("supplier_id", companyId)
        .order("id", { ascending: true })
        .range(offset, limit),
  );
  const seenPhones = new Set(existing.map((r) => r.phone));
  const seenEmails = new Set(
    existing
      .map((r) => r.email?.toLowerCase())
      .filter((e): e is string => !!e),
  );

  const outcome: ImportOutcome = { imported: 0, skippedDuplicates: 0, invalid: [] };
  const toInsert: { supplier_id: string; name: string; phone: string; email: string | null; city: string | null; source: string }[] = [];

  mapped.forEach((raw, index) => {
    const validated = validateCustomerRow(raw);
    if (!validated.ok) {
      outcome.invalid.push({ row: index + 1, message: validated.message });
      return;
    }
    const emailKey = validated.value.email?.toLowerCase();
    if (seenPhones.has(validated.value.phone) || (emailKey && seenEmails.has(emailKey))) {
      outcome.skippedDuplicates += 1;
      return;
    }
    seenPhones.add(validated.value.phone);
    if (emailKey) seenEmails.add(emailKey);
    toInsert.push({
      supplier_id: companyId,
      name: validated.value.name,
      phone: validated.value.phone,
      email: validated.value.email ?? null,
      city: validated.value.city ?? null,
      source: "import",
    });
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from("store_customers").insert(toInsert);
    if (error) {
      console.error("importCustomers failed:", error.code, error.message);
      return { ...errState("Could not import the customers. Try again."), imported: 0, skippedDuplicates: outcome.skippedDuplicates, invalid: outcome.invalid };
    }
    outcome.imported = toInsert.length;
  }

  revalidatePath(BASE);
  return { ok: true, message: "", ...outcome };
}
