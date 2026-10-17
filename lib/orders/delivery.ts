// Delivery-address shape shared by the address book (Phase 2), checkout
// (Phase 3) and the immutable snapshot stored on orders.delivery.
//
// Validation rules are shared with the database constraints in
// supabase/migrations/20261021000000_order_lifecycle.sql (phone / pincode
// regexes) and with lib/user-phone.ts (Indian mobile normalization).

import { z } from "zod";
import { isValidUserPhone, normalizeUserPhone } from "@/lib/user-phone";

/** Indian PIN code: 6 digits, never starting with 0. */
const PINCODE_RE = /^[1-9][0-9]{5}$/;

export const deliverySnapshotSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's full name.").max(80),
  phone: z
    .string()
    .trim()
    .transform(normalizeUserPhone)
    .refine(isValidUserPhone, "Enter a valid 10-digit Indian mobile number."),
  line1: z.string().trim().min(3, "Enter the street address.").max(200),
  line2: z.string().trim().max(200).nullish(),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  state: z.string().trim().min(2, "Enter the state.").max(80),
  pincode: z
    .string()
    .trim()
    .refine((value) => PINCODE_RE.test(value), "Enter a valid 6-digit PIN code."),
  instructions: z.string().trim().max(500).nullish(),
});

/** Immutable delivery snapshot stored on an order row. */
export type DeliverySnapshot = z.infer<typeof deliverySnapshotSchema>;

/**
 * Validate an untrusted address payload (form data / JSON) into a snapshot.
 * Returns the first error message, mirroring the buyer-action error style.
 */
export function parseDeliverySnapshot(
  raw: unknown,
): { ok: true; value: DeliverySnapshot } | { ok: false; error: string } {
  const parsed = deliverySnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the address fields and try again.",
    };
  }
  return { ok: true, value: { ...parsed.data, line2: parsed.data.line2 || null, instructions: parsed.data.instructions || null } };
}

/** One row of public.buyer_addresses. */
export type BuyerAddress = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  instructions: string | null;
  isDefault: boolean;
};

/** DB row -> domain shape. */
export function toDeliverySnapshot(address: BuyerAddress): DeliverySnapshot {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    instructions: address.instructions,
  };
}

/** Single-line rendering for receipts, supplier pages and WhatsApp links. */
export function formatDeliveryLine(snapshot: DeliverySnapshot): string {
  const parts = [snapshot.line1, snapshot.line2, snapshot.city, snapshot.state, snapshot.pincode];
  return parts.filter((part): part is string => Boolean(part)).join(", ");
}
