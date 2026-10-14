import { describe, expect, it } from "vitest";
import {
  classifyCustomer,
  mapCustomerCsvRows,
  parseCustomerCsv,
  parseCustomerSort,
  parseCustomerTab,
  validateCustomerRow,
} from "../lib/supplier/customers";

describe("parseCustomerTab / parseCustomerSort", () => {
  it("accepts known values and falls back", () => {
    expect(parseCustomerTab("returning")).toBe("returning");
    expect(parseCustomerTab("bogus")).toBe("all");
    expect(parseCustomerSort("sales")).toBe("sales");
    expect(parseCustomerSort("bogus")).toBe("recent");
  });
});

describe("classifyCustomer", () => {
  it("prefers imported, then returning over new", () => {
    expect(classifyCustomer("import", 10)).toBe("imported");
    expect(classifyCustomer("order", 3)).toBe("returning");
    expect(classifyCustomer("order", 1)).toBe("new");
    expect(classifyCustomer("manual", 0)).toBe("new");
  });
});

describe("validateCustomerRow", () => {
  it("normalizes phone and accepts a full row", () => {
    expect(
      validateCustomerRow({ name: "Meera Nair", phone: "+91 98250 12345", email: "m@x.com", city: "Bengaluru" }),
    ).toEqual({
      ok: true,
      value: { name: "Meera Nair", phone: "9825012345", email: "m@x.com", city: "Bengaluru" },
    });
  });

  it("rejects bad phone, bad email and short names", () => {
    expect(validateCustomerRow({ name: "Meera", phone: "12345" }).ok).toBe(false);
    expect(validateCustomerRow({ name: "Meera", phone: "9825012345", email: "nope" }).ok).toBe(false);
    expect(validateCustomerRow({ name: "M", phone: "9825012345" }).ok).toBe(false);
  });
});

describe("parseCustomerCsv / mapCustomerCsvRows", () => {
  it("handles headers, quotes and commas", () => {
    const rows = parseCustomerCsv(
      'Name,Mobile,Email,City\n"Patel, Ramesh",9825011111,r@x.com,"Ahmedabad, Gujarat"\nMeera,9825022222,,\n',
    );
    expect(mapCustomerCsvRows(rows)).toEqual([
      { name: "Patel, Ramesh", phone: "9825011111", email: "r@x.com", city: "Ahmedabad, Gujarat" },
      { name: "Meera", phone: "9825022222", email: "", city: "" },
    ]);
  });

  it("falls back to column order without headers", () => {
    const rows = parseCustomerCsv("Ramesh,9825011111,r@x.com,Surat\n");
    expect(mapCustomerCsvRows(rows)).toEqual([
      { name: "Ramesh", phone: "9825011111", email: "r@x.com", city: "Surat" },
    ]);
  });
});
