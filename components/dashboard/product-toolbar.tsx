"use client";

import { SearchInput } from "@/components/dashboard/search-input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { SORT_OPTIONS, type SortKey } from "@/components/dashboard/product-sort";

export function ProductToolbar({
  baseHref,
  tab,
  q,
  sort,
}: {
  baseHref: string;
  tab: string;
  q: string;
  sort: SortKey;
}) {
  return (
    <form
      action={baseHref}
      className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <SearchInput
        name="q"
        placeholder="Search products…"
        defaultValue={q}
        className="w-full sm:w-72"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by</span>
        <input type="hidden" name="tab" value={tab} />
        <NativeSelect
          name="sort"
          defaultValue={sort}
          size="sm"
          className="min-w-44"
          aria-label="Sort products"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {SORT_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </form>
  );
}