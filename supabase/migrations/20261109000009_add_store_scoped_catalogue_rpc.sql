-- Store-scoped catalogue RPC.
-- Extends list_storefront_products to accept a p_store_id parameter. When
-- provided, only products assigned to that store via store_products are
-- returned, using store-specific price_per_unit and moq from store_products.
-- When omitted, the existing behaviour (all products via storefront_prices)
-- is preserved.
-- Blocked by tickets 07, 08, 09.

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
store_scope as (
  select sp.global_product_id, sp.price_per_unit as store_price, sp.moq as store_moq
  from public.store_products sp
  join public.stores s on s.id = sp.store_id
  cross join input
  where sp.is_listed
    and s.status = 'active'
    and input.store_id is not null
    and s.id = input.store_id
),
filtered as materialized (
  select
    product.id,
    product.title,
    product.unit,
    coalesce(ss.store_moq, product.moq) as moq,
    product.negotiable,
    product.created_at,
    coalesce(ss.store_price, price.customer_price) as customer_price,
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
      when 'price_asc' then coalesce(ss.store_price, price.customer_price)
      when 'price_desc' then coalesce(ss.store_price, price.customer_price)
      when 'moq_asc' then coalesce(ss.store_moq, product.moq)::numeric
      when 'relevance' then array_position(p_candidate_ids, product.id)::numeric
      else extract(epoch from product.created_at)
    end as sort_value
  from public.products product
  join public.storefront_suppliers supplier on supplier.id = product.supplier_id
  join public.storefront_prices price on price.product_id = product.id
  left join store_scope ss on ss.global_product_id = product.id
  cross join input
  where product.status = 'approved'
    and product.is_hidden = false
    and (
      input.store_id is null
      or ss.global_product_id is not null
    )
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
    and (p_min_price is null or coalesce(ss.store_price, price.customer_price) >= p_min_price)
    and (p_max_price is null or coalesce(ss.store_price, price.customer_price) <= p_max_price)
    and (p_min_moq is null or coalesce(ss.store_moq, product.moq) >= p_min_moq)
    and (p_max_moq is null or coalesce(ss.store_moq, product.moq) <= p_max_moq)
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
  order by
    case
      when input.sort in ('newest', 'price_desc') then filtered.sort_value
    end desc nulls last,
    case
      when input.sort in ('price_asc', 'moq_asc', 'relevance') then filtered.sort_value
    end asc nulls last,
    case
      when input.sort in ('newest', 'price_desc') then filtered.id
    end desc,
    case
      when input.sort in ('price_asc', 'moq_asc', 'relevance') then filtered.id
    end asc
  limit (select page_size + 1 from input)
),
ranked as (
  select
    ordered.*,
    row_number() over (
      order by
        case
          when ordered.effective_sort in ('newest', 'price_desc') then ordered.sort_value
        end desc nulls last,
        case
          when ordered.effective_sort in ('price_asc', 'moq_asc', 'relevance') then ordered.sort_value
        end asc nulls last,
        case
          when ordered.effective_sort in ('newest', 'price_desc') then ordered.id
        end desc,
        case
          when ordered.effective_sort in ('price_asc', 'moq_asc', 'relevance') then ordered.id
        end asc
    ) as position
  from ordered
),
page as (
  select ranked.*
  from ranked
  order by ranked.position
  limit (select page_size from input)
),
meta as (
  select
    (select count(*) from filtered)::bigint as total,
    (select count(*) from ranked) > (select page_size from input) as has_more
)
select jsonb_build_object(
  'items', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'title', page.title,
          'unit', page.unit,
          'moq', page.moq,
          'negotiable', page.negotiable,
          'pricing', jsonb_build_object(
            'customer_price', page.customer_price
          ),
          'images', case
            when page.cover is null then '[]'::jsonb
            else jsonb_build_array(page.cover)
          end,
          'supplier', jsonb_build_object(
            'business_name', page.business_name,
            'city', page.city,
            'state', page.state,
            'logo_path', page.logo_path
          )
        )
        order by page.position
      )
      from page
    ),
    '[]'::jsonb
  ),
  'nextCursor', (
    select case
      when meta.has_more then jsonb_build_object(
        'value', page.sort_value,
        'id', page.id
      )
      else null
    end
    from page
    cross join meta
    order by page.position desc
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
