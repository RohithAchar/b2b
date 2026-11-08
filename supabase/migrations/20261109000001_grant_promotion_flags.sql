-- Grant column-level SELECT on the promotion flags added by
-- 20261102000001_product_promotion_flags.sql. The lockdown migration
-- (20261030200000) revoked blanket SELECT on public.products and re-granted a
-- specific column list that predates these flags, so anon/authenticated reads
-- filtering on is_winning / is_hot_selling currently fail with 42501.
grant select (is_winning, is_hot_selling) on public.products to anon, authenticated;