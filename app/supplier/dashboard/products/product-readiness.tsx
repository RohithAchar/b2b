import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
    <Card>
      <CardHeader>
        <CardTitle>Product readiness</CardTitle>
        <CardDescription>
          Guidance only — the server re-validates everything when you submit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={(done / checks.length) * 100}>
          <ProgressLabel>Checklist</ProgressLabel>
          <ProgressValue>{() => `${done} / ${checks.length}`}</ProgressValue>
        </Progress>
        <ul className="flex flex-col gap-2">
          {checks.map((c) => (
            <li
              key={c.label}
              className="flex items-start gap-2 text-sm"
              data-ready={c.ok ? "true" : "false"}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm",
                  c.ok ? "text-success" : "text-muted-foreground",
                )}
              >
                {c.ok ? (
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} />
                ) : (
                  <span className="size-1.5 rounded-sm bg-muted-foreground/40" />
                )}
              </span>
              <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>
                <span className="sr-only">{c.ok ? "Done: " : "Pending: "}</span>
                {c.label}
              </span>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Variants</span>
          <Badge variant="secondary">{variantCount}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
