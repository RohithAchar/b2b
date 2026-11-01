export type CategoryOption = {
  id: string;
  name: string;
};

export type ExistingVariant = {
  id?: string;
  label: string;
  attr_key?: string;
  attr_value?: string;
  seller_sku: string;
  price: number;
  moq: number | null;
  stock_qty: number;
};

export type ExistingImage = { id: string; path: string };

export type ExistingProduct = {
  id: string;
  title: string;
  category_id: string;
  seller_sku: string;
  hsn_code: string;
  gst_rate: number | null;
  carton_units: number | null;
  carton_dimensions: string | null;
  carton_weight_kg: number | null;
  description: string;
  unit: string;
  price_per_unit: number;
  negotiable: boolean;
  packaging_details: string | null;
  warranty_return: string | null;
  youtube_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_image_path: string | null;
  status: string;
  images: ExistingImage[];
  variants: ExistingVariant[];
};

export type InvalidField = { id: string; message: string } | null;

export type FieldErrorHelpers = {
  invalidFor: (id: string) => boolean | undefined;
  errorFor: (id: string) => React.ReactNode;
};