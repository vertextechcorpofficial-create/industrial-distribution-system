"use client";

// ============================================================================
// Customer History — Client Table State Hook
// Handles search, multi-type column sorting, and pagination (default 10/page).
// Built on pure memoized slices; all hooks called unconditionally.
// ============================================================================

import * as React from "react";
import { compareValues } from "../services/customer-history.helpers";

export type SortDirection = "asc" | "desc" | null;

export interface SortState<K extends string> {
  key: K | null;
  direction: SortDirection;
}

export interface UseTableStateOptions<T, K extends string> {
  rows: T[];
  defaultPageSize?: number;
  searchPredicate: (row: T, query: string) => boolean;
  sortAccessor: (row: T, key: K) => unknown;
}

export function useTableState<T, K extends string>({
  rows,
  defaultPageSize = 10,
  searchPredicate,
  sortAccessor,
}: UseTableStateOptions<T, K>) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortState<K>>({
    key: null,
    direction: null,
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  const filteredRows = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => searchPredicate(row, q));
  }, [rows, searchQuery, searchPredicate]);

  const sortedRows = React.useMemo(() => {
    if (!sort.key || !sort.direction) return filteredRows;
    const key = sort.key;
    const dir = sort.direction;
    return [...filteredRows].sort((a, b) =>
      compareValues(sortAccessor(a, key), sortAccessor(b, key), dir)
    );
  }, [filteredRows, sort, sortAccessor]);

  const totalCount = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedRows = React.useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safePage, pageSize]);

  const toggleSort = React.useCallback((key: K) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });
    setPage(1);
  }, []);

  const handleSearchChange = React.useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, []);

  const handlePageSizeChange = React.useCallback((nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  }, []);

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    sort,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize: handlePageSizeChange,
    totalCount,
    totalPages,
    filteredRows: sortedRows,
    pagedRows,
  };
}
