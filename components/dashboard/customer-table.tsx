"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, Download01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupees } from "@/lib/format";
import type { AudienceCustomer } from "@/lib/supplier/customer-queries";
import type { CustomerSort } from "@/lib/supplier/customers";

const BASE = "/supplier/dashboard/audience";

type PageParams = {
  q: string;
  tab: string;
  range: string;
};

const CATEGORY_BADGE = {
  new: "secondary",
  returning: "success",
  imported: "outline",
} as const;

function href(params: PageParams, overrides: Partial<PageParams & { sort: string; dir: string; page: number }>): string {
  const search = new URLSearchParams();
  const merged = { ...params, ...overrides };
  if (merged.q) search.set("q", merged.q);
  if (merged.tab && merged.tab !== "all") search.set("tab", merged.tab);
  if (merged.range && merged.range !== "30d") search.set("range", merged.range);
  if (merged.sort && merged.sort !== "recent") search.set("sort", merged.sort);
  if (merged.dir && merged.dir !== "desc") search.set("dir", merged.dir);
  if (merged.page && merged.page > 1) search.set("page", String(merged.page));
  const query = search.toString();
  return query ? `${BASE}?${query}` : BASE;
}

function paginationItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const window = new Set([1, total, current - 1, current, current + 1]);
  const items: (number | "…")[] = [];
  let prev = 0;
  for (const n of Array.from(window)
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b)) {
    if (prev && n - prev > 1) items.push("…");
    items.push(n);
    prev = n;
  }
  return items;
}

function SortHeader({
  label,
  column,
  sort,
  dir,
  params,
  className,
}: {
  label: string;
  column: CustomerSort;
  sort: CustomerSort;
  dir: "asc" | "desc";
  params: PageParams;
  className?: string;
}) {
  const active = sort === column;
  const nextDir = active && dir === "desc" ? "asc" : "desc";
  return (
    <TableHead className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={href(params, { sort: column, dir: nextDir, page: 1 })}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {active ? (
          <HugeiconsIcon
            icon={dir === "asc" ? ArrowUp01Icon : ArrowDown01Icon}
            strokeWidth={2.5}
            className="size-3.5"
          />
        ) : null}
      </Link>
    </TableHead>
  );
}

/**
 * Customer rows with selection, sortable headers and pagination. Selection
 * lives here for bulk export; sort/page navigation stays server-driven
 * through links so the URL remains the source of truth.
 */
export function CustomerTable({
  rows,
  sort,
  dir,
  page,
  totalPages,
  total,
  pageSize,
  params,
}: {
  rows: AudienceCustomer[];
  sort: CustomerSort;
  dir: "asc" | "desc";
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  params: PageParams;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pageIds = rows.map((row) => row.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of pageIds) next.add(id);
      } else {
        for (const id of pageIds) next.delete(id);
      }
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const exportHref = selected.size > 0 ? `/supplier/dashboard/audience/export?ids=${[...selected].join(",")}` : null;

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="tabular-nums">
            {selected.size} selected
          </span>
          {exportHref ? (
            <Button
              render={<a href={exportHref} download />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              <HugeiconsIcon icon={Download01Icon} strokeWidth={2} data-icon="inline-start" />
              Export selected
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all customers on this page"
                />
              </TableHead>
              <SortHeader label="Customer" column="name" sort={sort} dir={dir} params={params} />
              <TableHead className="hidden sm:table-cell">Contact</TableHead>
              <TableHead className="hidden md:table-cell">City</TableHead>
              <SortHeader
                label="Orders"
                column="orders"
                sort={sort}
                dir={dir}
                params={params}
                className="text-right tabular-nums"
              />
              <SortHeader
                label="Sales"
                column="sales"
                sort={sort}
                dir={dir}
                params={params}
                className="text-right tabular-nums"
              />
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={(checked) => toggleOne(row.id, checked === true)}
                    aria-label={`Select ${row.name}`}
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`${BASE}/${row.id}`}
                    className="block max-w-48 truncate font-medium hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.duplicate ? (
                    <span className="mt-0.5 block">
                      <Badge variant="warning" title="Another record shares this phone number or email">
                        Possible duplicate
                      </Badge>
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                  {row.phone}
                  {row.email ? <span className="block max-w-48 truncate text-xs">{row.email}</span> : null}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                  {row.city ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatRupees(row.totalSales)}
                </TableCell>
                <TableCell>
                  <Badge variant={CATEGORY_BADGE[row.category]}>
                    {row.category === "new" ? "New" : row.category === "returning" ? "Returning" : "Imported"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          Viewing {from}–{to} of {total} results
        </p>
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious href={href(params, { sort, dir, page: page - 1 })} />
                </PaginationItem>
              )}
              {paginationItems(page, totalPages).map((item, index) =>
                item === "…" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href={href(params, { sort, dir, page: item })}
                      isActive={item === page}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              {page < totalPages && (
                <PaginationItem>
                  <PaginationNext href={href(params, { sort, dir, page: page + 1 })} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
