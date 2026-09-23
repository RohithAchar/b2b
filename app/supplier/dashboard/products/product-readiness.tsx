import { cn } from "cn";
import { MIN_PRODUCT_IMAGES, MAX_PRODUCT_IMAGES } from "@/lib/supplier/products";
import { DESCRIPTION_MIN_TEXT_CHARS, plainTextLength } from "@/lib/supplier/rich-text";

type Check = { ok: boolean; label: string };

export function ProductReadiness({
  formValues,
  totalImages,
  variantCount,
}: {
  formValues: Map<string, string>;
  totalImages: number;
  variantCount: number;
}) {
  const value = (key: string): string => formValues.get(key) ?? "";

  const titleLength = value("title").trim().length;
  const descriptionLength = plainTextLength(value("description"));
  const sku = value("seller_sku").trim();
  const hsn = value("hsn_code").trim();
  const price = Number(value("price_per_unit"));
  const moq = Number(value("moq"));
  const gst = value("gst_rate").trim();

  const checks: Check[] = [
    { ok: titleLength >= 10, label: "Title — at least 10 characters" },
    { ok: descriptionLength >= DESCRIPTION_MIN_TEXT_CHARS, label: `Description — at least ${DESCRIPTION_MIN_TEXT_CHARS} characters of text` },
    { ok: totalImages >= MIN_PRODUCT_IMAGES, label: `Gallery — ${MIN_PRODUCT_IMAGES}+ images (${Math.min(totalImages, MAX_PRODUCT_IMAGES)}/${MAX_PRODUCT_IMAGES})` },
    { ok: /^[A-Za-z0-9-_]{3,30}$/.test(sku), label: "SKU — unique 3–30 character code" },
    { ok: /^\d{4,8}$/.test(hsn), label: "HSN — 4–8 digit GST code" },
    { ok: price > 0 && moq >= 1, label: "Price and MOQ set" },
    { ok: gst !== "", label: "GST rate selected" },
  ];
  const done = checks.filter((c) => c.ok).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Product readiness</p>
        <span className="text-xs tabular-nums text-muted-foreground">{done} / {checks.length}</span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex items-start gap-2 text-sm"
            data-ready={c.ok ? "true" : "false"}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold",
                c.ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {c.ok ? "✓" : "•"}
            </span>
            <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Variants</span>
        <span className="font-medium tabular-nums">{variantCount}</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        This checklist is guidance only — the server re-validates everything when you submit.
      </p>
    </div>
  );
}