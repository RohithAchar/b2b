/**
 * Ranked share list with percentage bars (top regions, categories, sources).
 * Bar widths are relative to the top entry so small shares stay visible;
 * the printed % is the true share of attributed sales.
 */
export function ShareBars({ items }: { items: { label: string; sharePct: number }[] }) {
  const max = Math.max(...items.map((item) => item.sharePct), 0);
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
              <span className="font-medium">{item.label}</span>
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{item.sharePct}%</span>
          </div>
          <div
            role="img"
            aria-label={`${item.label}, ${item.sharePct} percent of sales`}
            className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-muted"
          >
            <div
              className="h-full rounded-sm bg-primary"
              style={{ width: `${max === 0 ? 0 : (item.sharePct / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
