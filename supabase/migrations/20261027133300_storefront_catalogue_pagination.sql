-- Storefront catalogue: verified-supplier scope, keyset pagination and the
-- filters the homepage grid actually supports.
--
-- The function is SECURITY INVOKER, so the existing products RLS and the
-- public views remain the access boundary. It joins storefront_suppliers to
-- exclude products whose supplier is not verified, and storefront_prices for
-- customer-facing prices only. Base prices / margins are never projected.
--
-- Cursor values are opaque to the client and tied to the active sort:
--   newest          -> created_at epoch seconds, id
--   price_asc/desc  -> customer_price, id
--   moq_asc         -> moq, id
--   relevance       -> image-search array position, id
-- The function also applies the cursor, so pages are stable under inserts.

create index if not exists products_storefront_newest_idx
  on public.products (created_at desc, id desc)
  where status = 'approved' and is_hidden = false;

create index if not exists products_storefront_category_newest_idx
  on public.products (category_id, created_at desc, id desc)
  where status = 'approved' and is_hidden = false;

create index if not exists products_storefront_moq_idx
  on public.products (moq, id)
  where status = 'approved' and is_hidden = false;

create index if not exists categories_active_slug_idx
  on public.categories (slug)
  where is_active = true;

create index if not exists companies_verified_idx
  on public.companies (kyb_status)
  where kyb_status = 'verified';

-- Counts now cover every active category and include descendants for parents.
-- The old view only returned parent rows and counted unverified suppliers.
create or replace view public.category_product_counts as
select
  cat.id as category_id,
  count(distinct p.id)::bigint as product_count
from public.categories cat
join public.categories scope
  on scope.id = cat.id or scope.parent_id = cat.id
join public.products p
  on p.category_id = scope.id
  and p.status = 'approved'
  and p.is_hidden = false
join public.storefront_suppliers supplier on supplier.id = p.supplier_id
where cat.is_active = true
  and scope.is_active = true
group by cat.id;

grant select on public.category_product_counts to anon, authenticated;

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
  p_limit integer default 24
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
    end as cursor
),
category_scope as (
  select category.id
  from public.categories category
  cross join input
  where category.is_active = true
    and input.category_slug is not null
    and category.slug = input.category_slug
  union
  select child.id
  from public.categories child
  join public.categories parent on parent.id = child.parent_id
  cross join input
  where child.is_active = true
    and parent.is_active = true
    and input.category_slug is not null
    and parent.slug = input.category_slug
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
  boolean, boolean, boolean, uuid[], jsonb, integer
) from public;

grant execute on function public.list_storefront_products(
  text, text, text, numeric, numeric, integer, integer,
  boolean, boolean, boolean, uuid[], jsonb, integer
) to anon, authenticated, service_role;
