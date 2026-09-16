import { z } from "zod";
import { sniffSupportedDoc, isSupportedImageType, sniffImageType } from "@/lib/storage";

const upper = (v: string) => v.trim().toUpperCase();

export const gstinSchema = z
  .string()
  .transform(upper)
  .pipe(
    z
      .string()
      .regex(
        /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
        "Enter a valid 15-character GSTIN.",
      ),
  );

export const panSchema = z
  .string()
  .transform(upper)
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid 10-character PAN."),
  );

export const ifscSchema = z
  .string()
  .transform(upper)
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC (e.g. HDFC0001234)."),
  );

export const kybSchema = z.object({
  business_name: z.string().trim().min(2, "Business name is required."),
  contact_person: z.string().trim().min(2, "Contact person is required."),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number."),
  address: z.string().trim().min(5, "Registered address is required."),
  city: z.string().trim().min(2, "City is required."),
  state: z.string().trim().min(2, "State is required."),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  gstin: gstinSchema,
  pan: panSchema,
  bank_account: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "Enter a valid bank account number."),
  bank_ifsc: ifscSchema,
});

export type KybInput = z.input<typeof kybSchema>;
export type KybValues = z.output<typeof kybSchema>;

// Per-wizard-step slices — same rules as the full schema, no duplication.
export const kybStepSchemas = [
  kybSchema.pick({
    business_name: true,
    contact_person: true,
    phone: true,
    address: true,
    city: true,
    state: true,
    pincode: true,
  }),
  kybSchema.pick({ gstin: true, pan: true }),
  kybSchema.pick({ bank_account: true, bank_ifsc: true }),
] as const;

export const KYB_STEP_FIELDS = [
  ["business_name", "contact_person", "phone", "address", "city", "state", "pincode"],
  ["gstin", "pan"],
  ["bank_account", "bank_ifsc"],
] as const;

// Editable-anytime business profile: same rules, no status change.
export const businessProfileSchema = kybSchema.pick({
  business_name: true,
  contact_person: true,
});

export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function validateLogoFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) {
    return null;
  }
  if (file.size > MAX_LOGO_BYTES) {
    return "Logo must be under 2 MB.";
  }
  const detected = await sniffImageType(file);
  if (!isSupportedImageType(detected)) {
    return "Only JPG, PNG or WEBP images are allowed.";
  }
  return null;
}

export async function validateDocFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) {
    return null;
  }
  if (file.size > MAX_DOC_BYTES) {
    return "File must be under 10 MB.";
  }
  const detected = await sniffSupportedDoc(file, ["image", "pdf"]);
  if (!detected) {
    return "Only PDF, JPG or PNG files are allowed.";
  }
  return null;
}
