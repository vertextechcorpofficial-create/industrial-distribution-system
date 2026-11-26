"use client";

// ============================================================================
// Customer History — Reusable Searchable, Sortable, Paginated DataTable
// Features:
//   - `title` attribute on every column header <th>
//   - Clickable column sorting (asc -> desc -> none) with aria-sort
//   - Search input + page size selector (default 10 per page)
//   - Smooth framer-motion row transitions on page/sort/filter changes
// ============================================================================

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTableState } from "../hooks/useTableState";

export interface DataTableColumn<T, K extends string> {
  key: K;
  header: string;
  title: string; // HTML title tooltip required on table columns
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
  sortValue?: (row: T) => unknown;
  render: (row: T) => React.ReactNode;
}

interface DataTableLiteProps<T, K extends string> {
  rows: T[];
  columns: DataTableColumn<T, K>[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  searchPlaceholder?: string;
  searchPredicate: (row: T, query: string) => boolean;
  defaultPageSize?: number;
  onRowClick?: (row: T) => void;
  toolbarExtra?: React.ReactNode;
  onFilteredRowsChange?: (filtered: T[]) => void;
  onPagedRowsChange?: (paged: T[]) => void;
}

export function DataTableLite<T, K extends string>({
  rows,
  columns,
  rowKey,
  isLoading = false,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or applied filters.",
  searchPlaceholder = "Search table...",
  searchPredicate,
  defaultPageSize = 10,
  onRowClick,
  toolbarExtra,
  onFilteredRowsChange,
  onPagedRowsChange,
}: DataTableLiteProps<T, K>) {
  const columnMap = React.useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns]
  );

  const sortAccessor = React.useCallback(
    (row: T, key: K) => {
      const col = columnMap.get(key);
      if (col?.sortValue) return col.sortValue(row);
      return (row as Record<string, unknown>)[key];
    },
    [columnMap]
  );

  const {
    searchQuery,
    setSearchQuery,
    sort,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    totalPages,
    filteredRows,
    pagedRows,
  } = useTableState<T, K>({
    rows,
    defaultPageSize,
    searchPredicate,
    sortAccessor,
  });

  React.useEffect(() => {
    onFilteredRowsChange?.(filteredRows);
  }, [filteredRows, onFilteredRowsChange]);

  React.useEffect(() => {
    onPagedRowsChange?.(pagedRows);
  }, [pagedRows, onPagedRowsChange]);

  const startEntry = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endEntry = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: Search + Optional Extra */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 rounded-lg border-border/60 pl-9 pr-8 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear table search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {toolbarExtra && <div className="flex items-center gap-2">{toolbarExtra}</div>}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
        <div className="overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader className="border-b border-border/60 bg-muted/30">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => {
                  const isSorted = sort.key === col.key ? sort.direction : null;
                  const ariaSort =
                    isSorted === "asc"
                      ? "ascending"
                      : isSorted === "desc"
                        ? "descending"
                        : "none";
                  return (
                    <TableHead
                      key={col.key}
                      title={col.title}
                      aria-sort={col.sortable !== false ? ariaSort : undefined}
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.className
                      )}
                    >
                      {col.sortable !== false ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          title={col.title}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:text-foreground",
                            isSorted && "text-foreground"
                          )}
                        >
                          <span>{col.header}</span>
                          {isSorted === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-primary" />
                          ) : isSorted === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <span>{col.header}</span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`skel-${idx}`}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pagedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-12 text-center">
                    <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((row) => (
                  <motion.tr
                    key={rowKey(row)}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "h-[56px] border-b border-border/50 transition-colors last:border-none hover:bg-muted/30",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "overflow-hidden px-4 py-3 text-sm",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          col.className
                        )}
                      >
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <strong className="font-semibold text-foreground">
                {startEntry}-{endEntry}
              </strong>{" "}
              of <strong className="font-semibold text-foreground">{totalCount}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <span>Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="h-7 w-[70px] rounded-md text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(1)}
              disabled={page <= 1 || isLoading}
              title="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1 || isLoading}
              title="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-medium text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || isLoading}
              title="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isLoading}
              title="Last page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
