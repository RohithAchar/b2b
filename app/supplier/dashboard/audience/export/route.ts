import { createClient } from "@/lib/supabase/server";
import { getSupplierContext } from "@/lib/auth/guard";
import { parseDashboardRange, resolveRangeBounds } from "@/lib/supplier/analytics";
import {
  filterAudienceByTab,
  parseCustomerSort,
  parseCustomerTab,
  parseSortDirection,
  sortAudience,
} from "@/lib/supplier/customers";
import { getAudienceCustomers } from "@/lib/supplier/customer-queries";

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Download customers as CSV, honouring the list page's search, tab, range
 * and sort — or an explicit `ids` selection from the table. Scoped to the
 * signed-in supplier's own records.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Sign in required.", { status: 401 });
  }

  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx) {
    return new Response("Supplier onboarding required.", { status: 403 });
  }
  const companyId = ctx.companyId;

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const tab = parseCustomerTab(params.get("tab"));
  const range = parseDashboardRange(params.get("range"));
  const sort = parseCustomerSort(params.get("sort"));
  const dir = parseSortDirection(params.get("dir"));
  const ids = new Set(
    (params.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

  try {
    const { from, to } = resolveRangeBounds(range, new Date());
    const customers = await getAudienceCustomers(supabase, companyId, { q, from, to });
    let rows = filterAudienceByTab(customers, tab);
    if (ids.size > 0) {
      rows = rows.filter((row) => ids.has(row.id));
    }
    rows = sortAudience(rows, sort, dir);

    const lines = [
      "Name,Mobile Number,Email,City,Total Orders,Total Sales,Category,Source",
      ...rows.map((row) =>
        [
          csvCell(row.name),
          csvCell(row.phone),
          csvCell(row.email),
          csvCell(row.city),
          csvCell(row.orderCount),
          csvCell(row.totalSales),
          csvCell(row.category),
          csvCell(row.source),
        ].join(","),
      ),
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="customers-${stamp}.csv"`,
      },
    });
  } catch (error) {
    console.error("Customer export failed:", error);
    return new Response("Could not export customers.", { status: 500 });
  }
}
