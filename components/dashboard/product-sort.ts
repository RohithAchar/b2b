export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
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
  price_asc: { column: "price_per_unit", ascending: true },
  price_desc: { column: "price_per_unit", ascending: false },
};