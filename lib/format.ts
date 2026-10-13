// Shared formatting helpers (Indian locale). Dependency-free so they
// unit-test in isolation and can be used from any domain.

/** ₹ with Indian digit grouping: ₹11,57,449. */
export function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Plain Indian grouping without the symbol (chart axes, compact labels). */
export function formatIndianNumber(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** "12 Oct 2026" style date used across dashboards. */
export function formatDateMed(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
