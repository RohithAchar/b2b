interface FieldRule {
  match: string;
  field: string;
}

const FIELD_RULES: FieldRule[] = [
  { match: "sku: 3-30 chars", field: "seller_sku" },
  { match: "already use this sku", field: "seller_sku" },
  { match: "already used by another of your products", field: "seller_sku" },
  { match: "at least 3 images are required", field: "images" },
  { match: "at most 8 images", field: "images" },
  { match: "add at least", field: "images" },
  { match: "images total", field: "images" },
  { match: "each image must be", field: "images" },
  { match: "only jpg, png or webp", field: "images" },
  { match: "title needs at least", field: "title" },
  { match: "product title must be", field: "title" },
  { match: "description is required", field: "description" },
  { match: "description needs at least", field: "description" },
  { match: "product description must be", field: "description" },
  { match: "pick a subcategory", field: "category_id" },
  { match: "category is not active", field: "category_id" },
  { match: "hsn must be", field: "hsn_code" },
  { match: "hsn code must be", field: "hsn_code" },
  { match: "enter a valid youtube", field: "youtube_url" },
  { match: "moq must be at least", field: "moq" },
  { match: "price must be", field: "price_per_unit" },
  { match: "lead time must be", field: "lead_time_days" },
  { match: "invalid gst", field: "gst_rate" },
  { match: "pick a valid gst", field: "gst_rate" },
  { match: "invalid unit", field: "unit" },
];

export function fieldIdForMessage(message: string): string | undefined {
  const m = message.trim();
  if (!m) return undefined;
  const lower = m.toLowerCase();
  if (lower.includes("variant")) return undefined;
  for (const { match, field } of FIELD_RULES) {
    if (lower.includes(match)) return field;
  }
  return undefined;
}