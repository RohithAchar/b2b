export const PRODUCT_FORM_SECTIONS = [
  { id: "product-information", label: "Product Information" },
  { id: "product-media", label: "Product Media" },
  { id: "pricing", label: "Pricing" },
  { id: "inventory", label: "Inventory" },
  { id: "shipping-tax", label: "Shipping & Tax" },
  { id: "variants", label: "Variants" },
  { id: "product-seo", label: "Product SEO" },
] as const;

export type ProductFormSectionId = (typeof PRODUCT_FORM_SECTIONS)[number]["id"];