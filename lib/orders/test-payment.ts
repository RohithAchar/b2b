// TEST-ONLY payment collection details. No gateway is involved and no real
// money should ever be sent: this exists so the buyer -> supplier payment
// claim flow can be exercised end to end. Configure a clearly fake UPI id via
// NEXT_PUBLIC_TEST_UPI_ID; the fallback is deliberately not a real address.

/** Deliberately fake fallback — never point this at a real UPI id. */
export const TEST_UPI_ID =
  process.env.NEXT_PUBLIC_TEST_UPI_ID?.trim() || "testmode@upi";

export const TEST_UPI_NAME =
  process.env.NEXT_PUBLIC_TEST_UPI_NAME?.trim() || "B2B Test Payments";

/** Whether a test UPI id is explicitly configured (used to warn instead of
 *  quietly showing the deliberately-fake fallback). */
export const TEST_UPI_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_TEST_UPI_ID?.trim(),
);

/** Human-readable note shown to the payer inside their UPI app. */
export function testPaymentNote(reference: string): string {
  return `Order ${reference} (TEST MODE)`;
}

/**
 * Standard UPI deep link. The amount is fixed server-side from the accepted
 * quotation (or the order total), never taken from the browser.
 */
export function buildUpiUri({
  reference,
  amount,
}: {
  reference: string;
  amount: number;
}): string {
  const params = new URLSearchParams({
    pa: TEST_UPI_ID,
    pn: TEST_UPI_NAME,
    am: amount.toFixed(2),
    cu: "INR",
    tn: testPaymentNote(reference),
  });
  return `upi://pay?${params.toString()}`;
}

/** UPI apps refuse to encode without a positive amount. */
export function isPayableAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}
