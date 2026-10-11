-- Drop the enquiries workflow. The product has no enquiry feature:
-- cart + saved products + recently viewed cover the buyer workflow.
-- Dropping the table cascades its indexes and RLS policies.

drop table if exists public.enquiries;
