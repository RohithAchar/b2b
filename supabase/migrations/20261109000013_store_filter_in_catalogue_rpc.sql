-- Add store scoping to the storefront catalogue RPC. Products are filtered
-- by store_id when p_store_id is provided; null keeps the old behaviour
-- (all stores) for backward compatibility.
create or replace function public.list_storefront_products(
  p_query text default null,
  p_category_slug text default null,
  p_sort text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_moq integer default null,
  p_max_moq integer default null,
  p_in_stock boolean default false,
  p_negotiable boolean default false,
  p_sample_available boolean default false,
  p_candidate_ids uuid[] default null,
  p_cursor jsonb default null,
  p_limit integer default 24,
  p_store_id uuid default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
with input as (
  select
    nullif(btrim(coalesce(p_query, '')), '') as query,
    nullif(btrim(coalesce(p_category_slug, '')), '') as category_slug,
    case
      when p_sort = 'relevance' and p_candidate_ids is not null then 'relevance'
      when p_sort in ('newest', 'price_asc', 'price_desc', 'moq_asc') then p_sort
      else 'newest'
    end as sort,
    least(greatest(coalesce(p_limit, 24), 1), 60) as page_size,
    case
      when jsonb_typeof(p_cursor) = 'object'
        and jsonb_typeof(p_cursor -> 'value') = 'number'
        and (p_cursor ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then p_cursor
      else null
    end as cursor,
    p_store_id as store_id
),
category_scope as (
  select category.id
  from public.categories category
  cross join input
  where category.is_active = true
    and input.category_slug is not null
    and category.slug = input.category_slug
),
filtered as materialized (
  select
    product.id,
    product.title,
    product.unit,
    product.moq,
    product.negotiable,
    product.created_at,
    price.customer_price,
    supplier.business_name,
    supplier.city,
    supplier.state,
    supplier.logo_path,
    (
      select jsonb_build_object('path', image.path, 'sort', image.sort)
      from public.product_images image
      where image.product_id = product.id
      order by image.sort, image.id
      limit 1
    ) as cover,
    case input.sort
      when 'price_asc' then price.customer_price
      when 'price_desc' then price.customer_price
      when 'moq_asc' then product.moq::numeric
      when 'relevance' then array_position(p_candidate_ids, product.id)::numeric
      else extract(epoch from product.created_at)
    end as sort_value
  from public.products product
  join public.storefront_suppliers supplier on supplier.id = product.supplier_id
  join public.storefront_prices price on price.product_id = product.id
  cross join input
  where product.status = 'approved'
    and product.is_hidden = false
    and (input.store_id is null or product.store_id = input.store_id)
    and (
      input.query is null
      or to_tsvector('english', product.title)
        @@ websearch_to_tsquery('english', input.query)
    )
    and (
      input.category_slug is null
      or exists (
        select 1 from category_scope scope where scope.id = product.category_id
      )
    )
    and (
      p_candidate_ids is null
      or (
        cardinality(p_candidate_ids) <= 60
        and product.id = any(p_candidate_ids)
      )
    )
    and (p_min_price is null or price.customer_price >= p_min_price)
    and (p_max_price is null or price.customer_price <= p_max_price)
    and (p_min_moq is null or product.moq >= p_min_moq)
    and (p_max_moq is null or product.moq <= p_max_moq)
    and (not p_in_stock or product.stock_qty > 0)
    and (not p_negotiable or product.negotiable)
    and (not p_sample_available or product.sample_available)
),
ordered as (
  select filtered.*, input.sort as effective_sort
  from filtered
  cross join input
  where
    input.cursor is null
    or (
      input.sort in ('newest', 'price_desc')
      and (filtered.sort_value, filtered.id) < (
        (input.cursor ->> 'value')::numeric,
        (input.cursor ->> 'id')::uuid
      )
    )
    or (
      input.sort in ('price_asc', 'moq_asc', 'relevance')
      and (filtered.sort_value, filtered.id) > (
        (input.cursor ->> 'value')::numeric,
        (input.cursor ->> 'id')::uuid
      )
    )
),
page as (
  select ordered.*
  from ordered
  cross join input
  order by
    case when input.sort in ('newest', 'price_desc') then ordered.sort_value end desc nulls last,
    case when input.sort in ('price_asc', 'moq_asc', 'relevance') then ordered.sort_value end asc nulls last,
    ordered.id asc
  limit (select page_size from input) + 1
),
meta as (
  select
    count(*)::bigint as total,
    (select page_size from input) as page_size
  from filtered
)
select jsonb_build_object(
  'items', coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'id', page.id,
        'title', page.title,
        'unit', page.unit,
        'moq', page.moq,
        'negotiable', page.negotiable,
        'created_at', page.created_at,
        'customer_price', page.customer_price,
        'business_name', page.business_name,
        'city', page.city,
        'state', page.state,
        'logo_path', page.logo_path,
        'cover', page.cover
      ) order by page.position)
      from (
        select page.*, row_number() over (
          order by
            case when page.effective_sort in ('newest', 'price_desc') then page.sort_value end desc nulls last,
            case when page.effective_sort in ('price_asc', 'moq_asc', 'relevance') then page.sort_value end asc nulls last,
            page.id asc
        ) as position
        from page
      ) page
      where page.position <= (select page_size from meta)
    ),
    '[]'::jsonb
  ),
  'nextCursor', (
    select jsonb_build_object('value', page.sort_value, 'id', page.id)
    from (
      select page.*, row_number() over (
        order by
          case when page.effective_sort in ('newest', 'price_desc') then page.sort_value end desc nulls last,
          case when page.effective_sort in ('price_asc', 'moq_asc', 'relevance') then page.sort_value end asc nulls last,
          page.id asc
      ) as position
      from page
    ) page
    where page.position = (select page_size from meta) + 1
    limit 1
  ),
  'total', (select total from meta)
);
$$;

revoke all on function public.list_storefront_products(
  text, text, text, numeric, numeric, integer, integer,
  boolean, boolean, boolean, uuid[], jsonb, integer, uuid
) from public;

grant execute on function public.list_storefront_products(
  text, text, text, numeric, numeric, integer, integer,
  boolean, boolean, boolean, uuid[], jsonb, integer, uuid
) to anon, authenticated, service_role;
