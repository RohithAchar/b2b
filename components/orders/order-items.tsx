import { HugeiconsIcon } from "@hugeicons/react";
import { Package01Icon } from "@hugeicons/core-free-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupees } from "@/lib/format";

export type OrderItemView = {
  id: string;
  title: string;
  variantLabel?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  /** Public image URL when the product still has one; null otherwise. */
  imageUrl?: string | null;
};

function Thumb({ url }: { url?: string | null }) {
  if (!url) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground [&_svg]:size-5">
        <HugeiconsIcon icon={Package01Icon} strokeWidth={1.8} />
      </span>
    );
  }
  return (
    // Product thumbnails come from Supabase storage; no remote config needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-11 shrink-0 rounded-md border border-border object-cover"
    />
  );
}

function ItemMeta({ item }: { item: OrderItemView }) {
  return (
    <>
      <p className="truncate text-sm font-medium">{item.title}</p>
      <p className="truncate text-xs text-muted-foreground">
        {item.variantLabel ? `${item.variantLabel} · ` : ""}
        {item.unit}
      </p>
    </>
  );
}

/**
 * Order line items. Table on desktop, stacked cards on mobile. Prices are
 * rendered from the stored snapshot — the browser never recalculates totals.
 */
export function OrderItems({ items }: { items: OrderItemView[] }) {
  return (
    <>
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right tabular-nums">Qty</TableHead>
            <TableHead className="text-right tabular-nums">Unit price</TableHead>
            <TableHead className="text-right tabular-nums">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Thumb url={item.imageUrl} />
                  <div className="min-w-0">
                    <ItemMeta item={item} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.quantity}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatRupees(item.unitPrice)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatRupees(item.unitPrice * item.quantity)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="divide-y divide-border md:hidden">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 px-4 py-3">
            <Thumb url={item.imageUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <ItemMeta item={item} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {item.quantity} {item.unit} × {formatRupees(item.unitPrice)}
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatRupees(item.unitPrice * item.quantity)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
