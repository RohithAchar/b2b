-- Add carton/packaging specs to products. The supplier product form no longer
-- collects MOQ, stock, lead time or samples, so give those columns sensible
-- defaults for future inserts while keeping existing data intact.

alter table public.products
  add column carton_units integer,
  add column carton_dimensions text,
  add column carton_weight_kg numeric(10, 3);

alter table public.products
  add constraint products_carton_units_check
    check (carton_units is null or carton_units > 0),
  add constraint products_carton_weight_check
    check (carton_weight_kg is null or carton_weight_kg > 0),
  add constraint products_carton_dimensions_check
    check (carton_dimensions is null or char_length(carton_dimensions) <= 100);

alter table public.products
  alter column moq set default 1,
  alter column lead_time_days set default 7;
