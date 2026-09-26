// Price sorting is deliberately absent. Base prices become unreadable to
// `authenticated` once the pricing lockdown lands, and ORDER BY needs the same
// privilege as SELECT, so `order price_per_unit` would fail for the supplier's
// own list. Restoring it needs a security-definer list RPC, not a column grant.
export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const SORT_KEYS: SortKey[] = SORT_OPTIONS.map((o) => o.value);

export const SORT_COLUMNS: Record<
  SortKey,
  { column: string; ascending: boolean }
> = {
  newest: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  name_asc: { column: "title", ascending: true },
  name_desc: { column: "title", ascending: false },
};