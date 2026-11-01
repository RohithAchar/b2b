export type HighlightRow = { label: string; value: string }

/**
 * Structured spec table shown directly under the price. Thin dark rules keep
 * the mobile reading order (label left, value right) unambiguous.
 */
export function ProductHighlights({ rows }: { rows: HighlightRow[] }) {
  return (
    <section aria-labelledby="product-highlights-heading">
      <h2
        id="product-highlights-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Highlights
      </h2>
      <div className="mt-2 overflow-hidden rounded-lg border border-foreground/15">
        <table className="w-full border-collapse text-sm">
          <tbody className="divide-y divide-foreground/10">
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="w-1/2 px-3 py-2.5 text-left font-medium text-muted-foreground"
                >
                  {row.label}
                </th>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
