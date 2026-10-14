// Supplier audience: customer classification, CSV import parsing and row
// validation. Pure and dependency-free (except zod, already universal), so
// the list page, export route and unit tests share one implementation.
//
// Classification: source 'import' reads as Imported; a linked buyer with more
// than one order reads as Returning; everyone else reads as New. Order
// counts and sales always come from the orders table, never from columns.
import { z } from "zod";
import { normalizeUserPhone } from "@/lib/user-phone";

export const CUSTOMER_SOURCES = ["manual", "import", "order"] as const;
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

export const CUSTOMER_TABS = ["all", "new", "returning", "imported"] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number];

export const CUSTOMER_TAB_LABELS: Record<CustomerTab, string> = {
  all: "All",
  new: "New",
  returning: "Returning",
  imported: "Imported",
};

export function parseCustomerTab(raw: unknown): CustomerTab {
  if (typeof raw === "string" && (CUSTOMER_TABS as readonly string[]).includes(raw)) {
    return raw as CustomerTab;
  }
  return "all";
}

export const CUSTOMER_SORTS = ["recent", "name", "orders", "sales"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export function parseCustomerSort(raw: unknown): CustomerSort {
  if (typeof raw === "string" && (CUSTOMER_SORTS as readonly string[]).includes(raw)) {
    return raw as CustomerSort;
  }
  return "recent";
}

export function parseSortDirection(raw: unknown): "asc" | "desc" {
  return raw === "asc" ? "asc" : "desc";
}

/** New/returning/imported from source + linked order count. */
export function classifyCustomer(source: string, orderCount: number): Exclude<CustomerTab, "all"> {
  if (source === "import") return "imported";
  return orderCount > 1 ? "returning" : "new";
}

export type CustomerRow = {
  id: string;
  supplier_id: string;
  buyer_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  source: string;
  created_at: string;
};

const rowSchema = z.object({
  name: z.string().trim().min(2, "Name needs at least 2 characters.").max(120),
  phone: z.string().trim().min(1, "Mobile number is required."),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address.",
    }),
  city: z.string().trim().max(120).optional().transform((v) => (v === undefined || v === "" ? undefined : v)),
});

export type ValidatedCustomerRow = {
  name: string;
  phone: string;
  email?: string | undefined;
  city?: string | undefined;
};

/** Validate one customer (add-form or CSV row). Phone normalizes to 10 digits. */
export function validateCustomerRow(input: {
  name: string;
  phone: string;
  email?: string;
  city?: string;
}): { ok: true; value: ValidatedCustomerRow } | { ok: false; message: string } {
  const parsed = rowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid customer details." };
  }
  const normalized = normalizeUserPhone(parsed.data.phone);
  if (!/^[6-9]\d{9}$/.test(normalized)) {
    return { ok: false, message: "Enter a valid 10-digit mobile number." };
  }
  return {
    ok: true,
    value: {
      name: parsed.data.name,
      phone: normalized,
      ...(parsed.data.email ? { email: parsed.data.email } : {}),
      ...(parsed.data.city ? { city: parsed.data.city } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal CSV parsing (quotes, commas and newlines inside quotes). No
// dependency — import files are small and supplier-uploaded.
// ---------------------------------------------------------------------------

/** Split CSV text into rows of cells. */
export function parseCustomerCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    // Skip fully-empty rows (trailing newline, blank lines).
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushCell();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      // Ignore; \n handles the break.
    } else {
      cell += char;
    }
  }
  pushRow();
  return rows;
}

const HEADER_ALIASES: Record<string, "name" | "phone" | "email" | "city"> = {
  name: "name",
  customer: "name",
  "customer name": "name",
  phone: "phone",
  mobile: "phone",
  "mobile number": "phone",
  contact: "phone",
  email: "email",
  "e-mail": "email",
  "email address": "email",
  city: "city",
  town: "city",
};

/** Map raw rows to customer fields via header names, else column order. */
export function mapCustomerCsvRows(rows: string[][]): {
  name: string;
  phone: string;
  email: string;
  city: string;
}[] {
  if (rows.length === 0) return [];
  const [first, ...rest] = rows;
  const headerIndex = new Map<string, number>();
  let hasHeader = false;
  first.forEach((cell, index) => {
    const key = HEADER_ALIASES[cell.trim().toLowerCase()];
    if (key && !headerIndex.has(key)) {
      headerIndex.set(key, index);
      hasHeader = true;
    }
  });
  const dataRows = hasHeader ? rest : rows;
  return dataRows.map((cells) => {
    const at = (key: "name" | "phone" | "email" | "city", fallback: number) => {
      const index = headerIndex.get(key) ?? fallback;
      return (cells[index] ?? "").trim();
    };
    return { name: at("name", 0), phone: at("phone", 1), email: at("email", 2), city: at("city", 3) };
  });
}

export type ImportOutcome = {
  imported: number;
  skippedDuplicates: number;
  invalid: { row: number; message: string }[];
};

type SortableCustomer = {
  name: string;
  orderCount: number;
  totalSales: number;
  created_at: string;
  category: string;
};

/** Tab filter shared by the list page and the export route. */
export function filterAudienceByTab<T extends { category: string }>(list: T[], tab: CustomerTab): T[] {
  if (tab === "all") return list;
  return list.filter((row) => row.category === tab);
}

/** Sort shared by the list page and the export route. */
export function sortAudience<T extends SortableCustomer>(
  list: T[],
  sort: CustomerSort,
  dir: "asc" | "desc",
): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (sort) {
      case "name":
        return a.name.localeCompare(b.name, "en-IN") * factor;
      case "orders":
        return (a.orderCount - b.orderCount) * factor;
      case "sales":
        return (a.totalSales - b.totalSales) * factor;
      case "recent":
      default:
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * factor;
    }
  });
}
