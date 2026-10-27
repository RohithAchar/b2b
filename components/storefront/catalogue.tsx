"use client"

import { useId, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  FilterIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "cn"
import {
  buildCatalogueUrl,
  catalogueFiltersKey,
  countCatalogueFilters,
  parseCatalogueInteger,
  parseCatalogueNumber,
  type CatalogueFilters,
} from "@/lib/catalogue"
import { formatRupees } from "@/lib/format"
import type {
  CatalogueCategory,
  CataloguePage,
} from "@/lib/storefront"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { InfiniteCatalogueGrid } from "@/components/storefront/infinite-catalogue-grid"

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "moq_asc", label: "MOQ: Low to High" },
] as const

const IMAGE_SORT_OPTION = { value: "relevance", label: "Best match" } as const

function findCategory(categories: CatalogueCategory[], slug: string) {
  for (const category of categories) {
    if (category.slug === slug) return category
    const child = category.subcategories.find((sub) => sub.slug === slug)
    if (child) return child
  }
  return null
}

const PRICE_SLIDER_MAX = 100_000
const PRICE_SLIDER_STEP = 500
const MOQ_SLIDER_MAX = 500
const MOQ_SLIDER_STEP = 1

const PRICE_PRESETS = [
  { value: "under-500", label: "Under ₹500", max: 500 },
  { value: "500-2000", label: "₹500–2k", min: 500, max: 2_000 },
  { value: "2000-10000", label: "₹2k–10k", min: 2_000, max: 10_000 },
  { value: "10000-plus", label: "₹10k+", min: 10_000 },
] as const

const MOQ_PRESETS = [
  { value: "up-to-10", label: "Up to 10", max: 10 },
  { value: "10-50", label: "10–50", min: 10, max: 50 },
  { value: "50-100", label: "50–100", min: 50, max: 100 },
  { value: "100-plus", label: "100+", min: 100 },
] as const

type RangePreset = {
  value: string
  label: string
  min?: number
  max?: number
}

function selectedPreset(
  presets: readonly RangePreset[],
  minValue: string,
  maxValue: string,
  parse: (value: string | undefined) => number | undefined,
): string[] {
  const min = parse(minValue)
  const max = parse(maxValue)
  const match = presets.find(
    (preset) =>
      (preset.min ?? 0) === (min ?? 0) &&
      (preset.max ?? null) === (max ?? null),
  )
  return match ? [match.value] : []
}

function rangeLabel(
  minValue: string,
  maxValue: string,
  format: (value: number) => string,
  parse: (value: string | undefined) => number | undefined,
) {
  const min = parse(minValue)
  const max = parse(maxValue)
  return `${format(min ?? 0)} – ${max == null ? "Any" : format(max)}`
}

function FilterPanel({
  categories,
  filters,
  basePath,
  onNavigate,
}: {
  categories: CatalogueCategory[]
  filters: CatalogueFilters
  basePath: string
  onNavigate?: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const prefix = useId()
  const [minPrice, setMinPrice] = useState(
    filters.minPrice == null ? "" : String(filters.minPrice),
  )
  const [maxPrice, setMaxPrice] = useState(
    filters.maxPrice == null ? "" : String(filters.maxPrice),
  )
  const [minMoq, setMinMoq] = useState(
    filters.minMoq == null ? "" : String(filters.minMoq),
  )
  const [maxMoq, setMaxMoq] = useState(
    filters.maxMoq == null ? "" : String(filters.maxMoq),
  )

  const activeFilterCount = countCatalogueFilters(filters)
  const parsedMinPrice = parseCatalogueNumber(minPrice) ?? 0
  const parsedMaxPrice = parseCatalogueNumber(maxPrice) ?? PRICE_SLIDER_MAX
  const priceSliderMin = Math.min(
    Math.max(parsedMinPrice, 0),
    PRICE_SLIDER_MAX,
  )
  const priceSliderMax = Math.min(
    Math.max(parsedMaxPrice, priceSliderMin),
    PRICE_SLIDER_MAX,
  )
  const parsedMinMoq = parseCatalogueInteger(minMoq) ?? 0
  const parsedMaxMoq = parseCatalogueInteger(maxMoq) ?? MOQ_SLIDER_MAX
  const moqSliderMin = Math.min(Math.max(parsedMinMoq, 0), MOQ_SLIDER_MAX)
  const moqSliderMax = Math.min(
    Math.max(parsedMaxMoq, moqSliderMin),
    MOQ_SLIDER_MAX,
  )
  const pricePreset = selectedPreset(
    PRICE_PRESETS,
    minPrice,
    maxPrice,
    parseCatalogueNumber,
  )
  const moqPreset = selectedPreset(
    MOQ_PRESETS,
    minMoq,
    maxMoq,
    parseCatalogueInteger,
  )

  const navigate = (url: string) => {
    onNavigate?.()
    startTransition(() => router.push(url, { scroll: false }))
  }

  const setPresetRange = (
    preset: RangePreset | undefined,
    setMin: (value: string) => void,
    setMax: (value: string) => void,
  ) => {
    setMin(preset?.min == null ? "" : String(preset.min))
    setMax(preset?.max == null ? "" : String(preset.max))
  }

  const applyFilters = () => {
    let nextMinPrice = parseCatalogueNumber(minPrice)
    let nextMaxPrice = parseCatalogueNumber(maxPrice)
    if (
      nextMinPrice != null &&
      nextMaxPrice != null &&
      nextMinPrice > nextMaxPrice
    ) {
      ;[nextMinPrice, nextMaxPrice] = [nextMaxPrice, nextMinPrice]
    }

    let nextMinMoq = parseCatalogueInteger(minMoq)
    let nextMaxMoq = parseCatalogueInteger(maxMoq)
    if (nextMinMoq != null && nextMaxMoq != null && nextMinMoq > nextMaxMoq) {
      ;[nextMinMoq, nextMaxMoq] = [nextMaxMoq, nextMinMoq]
    }

    navigate(
      buildCatalogueUrl(basePath, filters, {
        minPrice: nextMinPrice,
        maxPrice: nextMaxPrice,
        minMoq: nextMinMoq,
        maxMoq: nextMaxMoq,
      }),
    )
  }

  const clearFilters = () => {
    navigate(
      buildCatalogueUrl(basePath, filters, {
        categorySlug: "",
        minPrice: undefined,
        maxPrice: undefined,
        minMoq: undefined,
        maxMoq: undefined,
        inStock: undefined,
        negotiable: undefined,
        sampleAvailable: undefined,
        imageToken: undefined,
        sort: filters.imageToken ? "newest" : filters.sort,
      }),
    )
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-busy={isPending}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={FilterIcon}
            strokeWidth={2}
            className="size-4 text-primary"
          />
          <p className="text-sm font-bold tracking-tight">Filters</p>
          {activeFilterCount > 0 ? (
            <Badge variant="secondary">{activeFilterCount}</Badge>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={clearFilters}
        >
          Reset
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Categories
            </p>
            <Link
              href={buildCatalogueUrl(basePath, filters, {
                categorySlug: "",
              })}
              onClick={onNavigate}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              All
            </Link>
          </div>
          <div className="mt-2 flex max-h-56 scrollbar-thin scrollbar-gutter-stable flex-col gap-0.5 overflow-y-auto">
            {categories.map((category) => {
              const parentActive = filters.categorySlug === category.slug
              const childActive = category.subcategories.some(
                (sub) => sub.slug === filters.categorySlug,
              )
              const expanded =
                (parentActive || childActive) &&
                category.subcategories.length > 0
              return (
                <div key={category.id}>
                  <Link
                    href={buildCatalogueUrl(basePath, filters, {
                      categorySlug: category.slug,
                    })}
                    onClick={onNavigate}
                    aria-current={parentActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      parentActive || childActive
                        ? "bg-primary/10 font-semibold text-primary"
                        : "font-medium text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{category.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[11px] font-normal tabular-nums",
                          parentActive || childActive
                            ? "text-primary/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {category.productCount}
                      </span>
                      {category.subcategories.length > 0 ? (
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          strokeWidth={2}
                          aria-hidden="true"
                          className={cn(
                            "size-3 text-muted-foreground transition-transform",
                            expanded && "rotate-90 text-primary",
                          )}
                        />
                      ) : null}
                    </span>
                  </Link>
                  {expanded ? (
                    <div className="mt-0.5 ml-2 flex flex-col gap-0.5 rounded-md border border-border/70 bg-muted/35 p-1">
                      {category.subcategories.map((sub) => (
                        <Link
                          key={sub.id}
                          href={buildCatalogueUrl(basePath, filters, {
                            categorySlug: sub.slug,
                          })}
                          onClick={onNavigate}
                          aria-current={
                            filters.categorySlug === sub.slug
                              ? "page"
                              : undefined
                          }
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-sm px-2 py-1 text-[13px] transition-colors",
                            filters.categorySlug === sub.slug
                              ? "bg-card font-semibold text-primary shadow-xs"
                              : "text-muted-foreground hover:bg-card hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{sub.name}</span>
                          <span className="shrink-0 text-[11px] tabular-nums">
                            {sub.productCount}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Price range
            </p>
            <span className="text-[11px] font-semibold text-foreground tabular-nums">
              {rangeLabel(
                minPrice,
                maxPrice,
                formatRupees,
                parseCatalogueNumber,
              )}
            </span>
          </div>
          <Slider
            className="mt-3"
            value={[priceSliderMin, priceSliderMax]}
            onValueChange={(value) => {
              const [nextMin, nextMax] = value as number[]
              setMinPrice(nextMin > 0 ? String(nextMin) : "")
              setMaxPrice(nextMax < PRICE_SLIDER_MAX ? String(nextMax) : "")
            }}
            min={0}
            max={PRICE_SLIDER_MAX}
            step={PRICE_SLIDER_STEP}
            largeStep={PRICE_SLIDER_STEP * 10}
            thumbLabels={["Minimum price", "Maximum price"]}
          />
          <ToggleGroup
            aria-label="Price presets"
            variant="outline"
            size="sm"
            className="mt-3 flex w-full flex-wrap gap-1.5"
            value={pricePreset}
            onValueChange={(values) =>
              setPresetRange(
                PRICE_PRESETS.find((preset) => preset.value === values[0]),
                setMinPrice,
                setMaxPrice,
              )
            }
          >
            {PRICE_PRESETS.map((preset) => (
              <ToggleGroupItem
                key={preset.value}
                value={preset.value}
                className="h-7 flex-1 basis-[calc(50%-0.375rem)] justify-start rounded-sm px-2 text-[11px] aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary"
              >
                {preset.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field className="gap-1">
              <FieldLabel
                htmlFor={`${prefix}-min-price`}
                className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
              >
                Min
              </FieldLabel>
              <InputGroup className="h-8">
                <InputGroupAddon>
                  <InputGroupText>₹</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={`${prefix}-min-price`}
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="0"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                />
              </InputGroup>
            </Field>
            <Field className="gap-1">
              <FieldLabel
                htmlFor={`${prefix}-max-price`}
                className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
              >
                Max
              </FieldLabel>
              <InputGroup className="h-8">
                <InputGroupAddon>
                  <InputGroupText>₹</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={`${prefix}-max-price`}
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="Any"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                />
              </InputGroup>
            </Field>
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Minimum order
            </p>
            <span className="text-[11px] font-semibold text-foreground tabular-nums">
              {rangeLabel(
                minMoq,
                maxMoq,
                String,
                parseCatalogueInteger,
              )}
            </span>
          </div>
          <Slider
            className="mt-3"
            value={[moqSliderMin, moqSliderMax]}
            onValueChange={(value) => {
              const [nextMin, nextMax] = value as number[]
              setMinMoq(nextMin > 0 ? String(nextMin) : "")
              setMaxMoq(nextMax < MOQ_SLIDER_MAX ? String(nextMax) : "")
            }}
            min={0}
            max={MOQ_SLIDER_MAX}
            step={MOQ_SLIDER_STEP}
            largeStep={25}
            thumbLabels={["Minimum order", "Maximum order"]}
          />
          <ToggleGroup
            aria-label="Minimum order presets"
            variant="outline"
            size="sm"
            className="mt-3 flex w-full flex-wrap gap-1.5"
            value={moqPreset}
            onValueChange={(values) =>
              setPresetRange(
                MOQ_PRESETS.find((preset) => preset.value === values[0]),
                setMinMoq,
                setMaxMoq,
              )
            }
          >
            {MOQ_PRESETS.map((preset) => (
              <ToggleGroupItem
                key={preset.value}
                value={preset.value}
                className="h-7 flex-1 basis-[calc(50%-0.375rem)] justify-start rounded-sm px-2 text-[11px] aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary"
              >
                {preset.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field className="gap-1">
              <FieldLabel
                htmlFor={`${prefix}-min-moq`}
                className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
              >
                Min
              </FieldLabel>
              <Input
                id={`${prefix}-min-moq`}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                className="h-8 bg-input/30"
                value={minMoq}
                onChange={(event) => setMinMoq(event.target.value)}
              />
            </Field>
            <Field className="gap-1">
              <FieldLabel
                htmlFor={`${prefix}-max-moq`}
                className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
              >
                Max
              </FieldLabel>
              <Input
                id={`${prefix}-max-moq`}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Any"
                className="h-8 bg-input/30"
                value={maxMoq}
                onChange={(event) => setMaxMoq(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <Button className="w-full" onClick={applyFilters}>
          Apply filters
        </Button>
      </div>
    </div>
  )
}

export function Catalogue({
  categoryData,
  filters,
  initialPage,
  basePath,
  title,
  description,
  headingLevel = "h2",
}: {
  categoryData: CatalogueCategory[]
  filters: CatalogueFilters
  initialPage: CataloguePage
  basePath: string
  title: string
  description?: string
  headingLevel?: "h1" | "h2"
}) {
  const router = useRouter()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const filterKey = catalogueFiltersKey(filters)
  const activeFilterCount = countCatalogueFilters(filters)
  const activeCategory = filters.categorySlug
    ? findCategory(categoryData, filters.categorySlug)
    : null
  const hasImageSearch = !!filters.imageToken
  const sortOptions = hasImageSearch
    ? [IMAGE_SORT_OPTION, ...SORT_OPTIONS]
    : SORT_OPTIONS

  const activeFilters = [
    filters.minPrice != null
      ? {
          key: "minPrice",
          label: `Min price: ₹${filters.minPrice}`,
          overrides: { minPrice: undefined },
        }
      : null,
    filters.maxPrice != null
      ? {
          key: "maxPrice",
          label: `Max price: ₹${filters.maxPrice}`,
          overrides: { maxPrice: undefined },
        }
      : null,
    filters.minMoq != null
      ? {
          key: "minMoq",
          label: `Min MOQ: ${filters.minMoq}`,
          overrides: { minMoq: undefined },
        }
      : null,
    filters.maxMoq != null
      ? {
          key: "maxMoq",
          label: `Max MOQ: ${filters.maxMoq}`,
          overrides: { maxMoq: undefined },
        }
      : null,
    filters.inStock
      ? {
          key: "inStock",
          label: "In stock",
          overrides: { inStock: undefined },
        }
      : null,
    filters.negotiable
      ? {
          key: "negotiable",
          label: "Negotiable",
          overrides: { negotiable: undefined },
        }
      : null,
    filters.sampleAvailable
      ? {
          key: "sampleAvailable",
          label: "Sample available",
          overrides: { sampleAvailable: undefined },
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null)

  const clearAll = () => {
    startTransition(() =>
      router.push(
        buildCatalogueUrl(basePath, filters, {
          categorySlug: "",
          minPrice: undefined,
          maxPrice: undefined,
          minMoq: undefined,
          maxMoq: undefined,
          inStock: undefined,
          negotiable: undefined,
          sampleAvailable: undefined,
          imageToken: undefined,
          sort: hasImageSearch ? "newest" : filters.sort,
        }),
        { scroll: false },
      ),
    )
  }

  const Heading = headingLevel

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto lg:pr-1">
        <FilterPanel
          key={filterKey}
          categories={categoryData}
          filters={filters}
          basePath={basePath}
        />
      </aside>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Heading className="text-xl font-bold tracking-tight text-foreground">
              {title}
            </Heading>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {initialPage.total.toLocaleString("en-IN")} product
              {initialPage.total === 1 ? "" : "s"}
              {filters.query ? <> for &ldquo;{filters.query}&rdquo;</> : null}
              {activeCategory ? <> in {activeCategory.name}</> : null}
            </p>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filtersOpen || activeFilterCount > 0 ? "default" : "outline"}
              size="sm"
              className="lg:hidden"
              onClick={() => setFiltersOpen(true)}
              aria-expanded={filtersOpen}
              aria-controls="catalogue-mobile-filters"
            >
              <HugeiconsIcon
                icon={FilterIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Filters
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>

            <Select
              value={filters.sort}
              onValueChange={(value) => {
                if (!value) return
                startTransition(() =>
                  router.push(
                    buildCatalogueUrl(basePath, filters, {
                      sort: value as CatalogueFilters["sort"],
                    }),
                    { scroll: false },
                  ),
                )
              }}
            >
              <SelectTrigger aria-label="Sort products" className="w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasImageSearch ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <HugeiconsIcon
                icon={Search01Icon}
                strokeWidth={2}
                className="size-4 text-primary"
              />
              Showing products visually similar to your photo.
            </p>
            <Link
              href={buildCatalogueUrl(basePath, filters, {
                imageToken: undefined,
                sort: "newest",
              })}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear image search
            </Link>
          </div>
        ) : null}

        {(activeCategory || activeFilters.length > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {activeCategory ? (
              <Link
                href={buildCatalogueUrl(basePath, filters, { categorySlug: "" })}
                aria-label={`Remove ${activeCategory.name} filter`}
                className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                {activeCategory.name}
                <span aria-hidden>×</span>
              </Link>
            ) : null}
            {activeFilters.map((filter) => (
              <Link
                key={filter.key}
                href={buildCatalogueUrl(basePath, filters, filter.overrides)}
                aria-label={`Remove ${filter.label} filter`}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {filter.label}
                <span aria-hidden>×</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        <div
          className={isPending ? "pointer-events-none opacity-60" : undefined}
          aria-busy={isPending}
        >
          <InfiniteCatalogueGrid
            key={filterKey}
            initialPage={initialPage}
            filters={filters}
          />
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          id="catalogue-mobile-filters"
          side="bottom"
          className="max-h-[88svh] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Filter products</SheetTitle>
            <SheetDescription>
              Narrow the catalogue by category, price and minimum order.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FilterPanel
              key={filterKey}
              categories={categoryData}
              filters={filters}
              basePath={basePath}
              onNavigate={() => setFiltersOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
