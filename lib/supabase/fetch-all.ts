// Paginated reads for server-side analytics.
//
// PostgREST caps every response at the project's `max_rows` setting (1,000 in
// supabase/config.toml). A single `.limit(10000)` therefore silently returns
// 1,000 rows and undercounts every total built from it. Callers page with
// `.range()` until a short page arrives, and fail loudly instead of rendering a
// number we know is truncated.

export const SUPABASE_PAGE_SIZE = 1000;
export const SUPABASE_MAX_ANALYTICS_ROWS = 50_000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchAllRows<T>(
  label: string,
  run: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: {
    pageSize?: number;
    maxRows?: number;
  } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? SUPABASE_PAGE_SIZE;
  const maxRows = options.maxRows ?? SUPABASE_MAX_ANALYTICS_ROWS;
  const rows: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await run(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`${label} query failed: ${error.message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
    if (rows.length >= maxRows) {
      throw new Error(
        `${label} exceeds ${maxRows.toLocaleString("en-IN")} rows; narrow the date range.`,
      );
    }
  }
}
