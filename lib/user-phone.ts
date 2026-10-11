/**
 * Buyer/supplier phone capture (temporary, pre-verification).
 *
 * Phone is mandatory after login but — for now — stored only in
 * `localStorage` under {@link USER_PHONE_STORAGE_KEY}. No OTP verification
 * yet. Validation reuses the same 10-digit Indian mobile rule as the
 * supplier KYB form (`lib/supplier/kyb.ts`).
 */

export const USER_PHONE_STORAGE_KEY = "b2b:user-phone";

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

export function getStoredUserPhone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_PHONE_STORAGE_KEY);
    if (!raw) return null;
    return isValidUserPhone(raw) ? normalizeUserPhone(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUserPhone(raw: string): string | null {
  const normalized = normalizeUserPhone(raw);
  if (!isValidUserPhone(normalized)) return null;
  try {
    window.localStorage.setItem(USER_PHONE_STORAGE_KEY, normalized);
  } catch {
    return null;
  }
  return normalized;
}

export function clearStoredUserPhone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_PHONE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode) — gate will just re-ask.
  }
}
