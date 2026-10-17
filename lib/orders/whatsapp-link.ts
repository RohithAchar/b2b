// Buyer -> supplier WhatsApp contact link.
//
// This is a plain wa.me deep link that opens the buyer's own WhatsApp with a
// pre-filled message — nothing is sent automatically, no credentials are
// involved, and the message carries only the order reference and the
// supplier's business name. Delivery addresses, phone numbers and prices are
// never placed into the link text.

/**
 * Build a wa.me deep link for an Indian mobile number, or null when the
 * stored number cannot be turned into a valid +91 mobile (any caller should
 * then fall back to a plain "contact the supplier" message instead).
 *
 * Accepts 10-digit national numbers and common +91 / 0-prefixed forms, since
 * `companies.phone` is free text entered during KYB.
 */
export function whatsappContactLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  let national = digits;
  if (digits.length === 10) {
    national = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else if (digits.length === 13 && digits.startsWith("910")) {
    national = digits.slice(3);
  } else {
    return null;
  }
  // Indian mobiles start 6-9 (same rule as buyer_addresses in the schema).
  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return `https://wa.me/91${national}?text=${encodeURIComponent(message)}`;
}

/** The only content allowed in the pre-filled message: reference + name. */
export function contactMessage(supplierName: string, reference: string): string {
  return `Hello ${supplierName}, I would like to discuss my order ${reference}.`;
}
