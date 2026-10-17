// Quotation input rules and total math, shared by the supplier quote form
// (preview) and the server action that calls `create_quotation`. The RPC
// recomputes every total in SQL anyway — these helpers keep the UI honest
// and the action's input validation strict.

import { z } from "zod";

/** Round to 2 decimals (paise) — mirrors SQL round(numeric, 2). */
export function roundRupees(value: number): number {
  return Math.round(value * 100) / 100;
}

export const quotationLineSchema = z.object({
  orderItemId: z.string().uuid("Invalid order line."),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(999_999, "Quantity is too large."),
  unitPrice: z.coerce
    .number()
    .min(0, "Unit price can't be negative.")
    .max(100_000_000, "Unit price is too large."),
});

export const QUOTATION_MAX_MONEY = 10_000_000;
export const QUOTATION_MAX_NOTE = 500;

export const quotationInputSchema = z.object({
  lines: z
    .array(quotationLineSchema)
    .min(1, "Add at least one line to the quotation."),
  deliveryCharge: z.coerce
    .number()
    .min(0, "Delivery charge can't be negative.")
    .max(QUOTATION_MAX_MONEY, "Delivery charge is too large."),
  taxAmount: z.coerce
    .number()
    .min(0, "Tax amount can't be negative.")
    .max(QUOTATION_MAX_MONEY, "Tax amount is too large."),
  note: z
    .string()
    .trim()
    .max(QUOTATION_MAX_NOTE, "Keep the note under 500 characters.")
    .optional(),
  /** Date input (YYYY-MM-DD); accepted only when in the future. */
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid expiry date.")
    .optional(),
});

export type QuotationLineInput = z.infer<typeof quotationLineSchema>;
export type QuotationInput = z.infer<typeof quotationInputSchema>;

export type QuotationTotals = {
  subtotal: number;
  total: number;
};

/**
 * Server-mirrored total math: line totals round to paise, then charges add
 * on top. Must stay in step with create_quotation in the migration.
 */
export function computeQuotationTotals(
  lines: QuotationLineInput[],
  deliveryCharge: number,
  taxAmount: number,
): QuotationTotals {
  const subtotal = lines.reduce(
    (sum, line) => sum + roundRupees(line.unitPrice * line.quantity),
    0,
  );
  return {
    subtotal: roundRupees(subtotal),
    total: roundRupees(subtotal + deliveryCharge + taxAmount),
  };
}

/**
 * Convert a date-only expiry input into an end-of-day timestamp (UTC).
 * Returns null when absent or unparseable so the caller can validate.
 */
export function expiryToIso(expiresOn: string | undefined): string | null {
  if (!expiresOn) return null;
  const date = new Date(`${expiresOn}T23:59:59Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
