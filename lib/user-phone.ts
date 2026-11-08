/**
 * Indian mobile number normalization + validation.
 *
 * Shared by the delivery address flow (`lib/orders/delivery.ts`) and the
 * supplier customer audience import (`lib/supplier/customers.ts`). The previous
 * "mandatory post-login phone capture" feature has been removed.
 */

const PHONE_RE = /^[6-9]\d{9}$/;

/** Strip formatting: spaces, dashes, leading +91 / 91 / 0. */
export function normalizeUserPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

export function isValidUserPhone(raw: string): boolean {
  return PHONE_RE.test(normalizeUserPhone(raw));
}