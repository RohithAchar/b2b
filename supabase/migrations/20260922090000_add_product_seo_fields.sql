-- Product SEO fields (optional metadata for the storefront <head>).
-- Suppliers control these directly; RLS already limits writes to their own
-- products and the approval-field guard trigger does not cover them.
--
-- seo_image_path lives in the same public "product_images" bucket under an
-- "{uid}/seo/..." storage path. It is separate from the gallery and is never
-- counted toward the 3..8 gallery-image minimum enforced by
-- internal.validate_product_for_approval().

alter table public.products
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_image_path text;