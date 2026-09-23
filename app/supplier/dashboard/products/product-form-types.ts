export type CategoryOption = {
  id: string;
  name: string;
  parentName: string | null;
};

export type CategoryGroup = {
  parent: CategoryOption;
  children: CategoryOption[];
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
  brand: string | null;
  seller_sku: string;
  hsn_code: string;
  description: string;
  unit: string;
  price_per_unit: number;
  moq: number;
  stock_qty: number;
  negotiable: boolean;
  sample_available: boolean;
  sample_price: number | null;
  lead_time_days: number;
  gst_rate: number | null;
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