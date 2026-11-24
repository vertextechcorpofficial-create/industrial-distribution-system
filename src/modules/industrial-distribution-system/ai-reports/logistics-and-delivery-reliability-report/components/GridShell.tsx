/**
 * Shared sortable + paginated table shell for the Logistics report grids
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - One shell serves all four segmented views so row counts, sort semantics and pagination
 *   behave identically wherever the reader looks.
 * - Page resets derive during render (no effect) following the project idiom.
 * - Each table now carries its own filter box. It matches only what that table shows — every column's
 *   own value — so a reader can narrow one grid without touching the period or the other tabs. The
 *   header search stays a separate, wider thing (it also reaches customer names, which no column shows).
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Search,
} from 'lucide-react';

export interface GridColumn<T> {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    /** Omit for columns that are text decorations and must not sort. */
    sortValue?: (row: T) => string | number | null | undefined;
    /**
     * What the filter box matches for this column. Defaults to `sortValue`, which is the stored code
     * — so a status column overrides this with the words the pill actually prints, and typing
     * "arrived late" finds the row the reader can see.
     */
    searchValue?: (row: T) => string | number | null | undefined;
    render: (row: T) => React.ReactNode;
    /** Extra classes for the body cell (e.g. tabular numerals). */
    cellClassName?: string;
}

interface GridShellProps<T> {
    title: string;
    subtitle?: string;
    rows: T[];
    columns: GridColumn<T>[];
    rowKey: (row: T) => string | number;
    onRowClick?: (row: T) => void;
    activeRowKey?: string | number | null;
    emptyMessage: string;
    defaultSortKey?: string;
    defaultSortDirection?: 'asc' | 'desc';
    pageSizeOptions?: number[];
}

type SortDirection = 'asc' | 'desc';

const alignClass = (align?: 'left' | 'center' | 'right') =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

/**
 * One frame for both sides of the filter comparison. Codes such as NO_COMMITMENT or a
 * "Central Luzon__Pangasinan" route key must still answer to the words a reader can see on screen,
 * so separators fold to single spaces before matching.
 */
const searchFrame = (value: unknown) =>
    String(value ?? '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export function GridShell<T>({
    title,
    subtitle,
    rows,
    columns,
    rowKey,
    onRowClick,
    activeRowKey,
    emptyMessage,
    defaultSortKey,
    defaultSortDirection = 'desc',
    pageSizeOptions = [10, 25, 50, 100],
}: GridShellProps<T>) {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizeOptions[1] ?? 25);
    const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);
    const [query, setQuery] = useState('');

    const needle = searchFrame(query);

    // Filtering runs before sorting so a header click orders exactly the rows the reader is looking at.
    const filteredRows = useMemo(() => {
        if (!needle) return rows; // same array identity: an empty box must not restart anything
        return rows.filter((row) =>
            columns.some((column) => {
                const read = column.searchValue ?? column.sortValue;
                if (!read) return false;
                return searchFrame(read(row)).includes(needle);
            })
        );
    }, [rows, columns, needle]);

    // Any change to the incoming row set, the filter, or the ordering restarts the reader at page 1.
    const filtersKey = `${filteredRows.length}_${needle}_${sortKey}_${sortDirection}_${pageSize}`;
    const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
    if (prevFiltersKey !== filtersKey) {
        setPrevFiltersKey(filtersKey);
        setCurrentPage(1);
    }

    const orderedRows = useMemo(() => {
        if (!sortKey) return filteredRows;
        const column = columns.find((c) => c.key === sortKey);
        if (!column?.sortValue) return filteredRows;
        const accessor = column.sortValue;
        const list = [...filteredRows];
        list.sort((a, b) => {
            const aVal = accessor(a);
            const bVal = accessor(b);
            // Empty measurements always sink to the bottom regardless of direction.
            if (aVal === null || aVal === undefined || aVal === '') return 1;
            if (bVal === null || bVal === undefined || bVal === '') return -1;
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [filteredRows, sortKey, sortDirection, columns]);

    const totalRecords = orderedRows.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const paginatedRows = orderedRows.slice(startIndex, endIndex);

    const handleHeaderClick = (column: GridColumn<T>) => {
        if (!column.sortValue) return;
        if (sortKey === column.key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(column.key);
            setSortDirection(defaultSortKey === column.key ? defaultSortDirection : 'desc');
        }
    };

    const renderSortIcon = (column: GridColumn<T>) => {
        if (!column.sortValue) return null;
        if (sortKey !== column.key) {
            return <ArrowUpDown className="h-3 w-3 opacity-40 ml-1 inline" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
        ) : (
            <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />
        );
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border/80 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                    <p className="text-xs text-muted-foreground">
                        {subtitle ?? `Showing ${totalRecords} records.`}
                    </p>
                </div>

                {/* Table-local filter: narrows these rows only, never the period or the other tabs. */}
                <div className="relative shrink-0 sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label={`Filter rows in ${title}`}
                        placeholder="Filter rows in this table"
                        className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    onClick={() => handleHeaderClick(column)}
                                    className={`py-2.5 px-3 whitespace-nowrap ${alignClass(column.align)} ${
                                        column.sortValue
                                            ? 'cursor-pointer hover:text-foreground transition-colors'
                                            : ''
                                    }`}
                                >
                                    {column.label}
                                    {renderSortIcon(column)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                                    {/* A missed filter and an empty period are different problems to fix. */}
                                    {needle && totalRecords === 0
                                        ? `No row in this table matches "${query.trim()}".`
                                        : emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row) => {
                                const key = rowKey(row);
                                const isSelected = activeRowKey !== null && activeRowKey !== undefined && activeRowKey === key;
                                return (
                                    <tr
                                        key={key}
                                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                                        className={`transition-colors ${
                                            onRowClick ? 'cursor-pointer hover:bg-muted/40' : ''
                                        } ${isSelected ? 'bg-primary/5 font-medium' : ''}`}
                                    >
                                        {columns.map((column) => (
                                            <td
                                                key={column.key}
                                                className={`py-2.5 px-3 ${alignClass(column.align)} ${
                                                    column.cellClassName ?? ''
                                                }`}
                                            >
                                                {column.render(row)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-muted/20">
                <div className="text-muted-foreground text-[11px]">
                    {totalRecords > 0 ? (
                        <>
                            Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{' '}
                            <span className="font-semibold text-foreground">{endIndex}</span> of{' '}
                            <span className="font-semibold text-foreground">{totalRecords}</span> entries
                        </>
                    ) : (
                        // The table body already carries the tailored empty message; repeating "nothing here"
                        // in the footer shows the same state twice.
                        '—'
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="px-2 py-1 rounded border border-input bg-background text-foreground text-xs"
                        >
                            {pageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                            title="First Page"
                        >
                            <ChevronsLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                            title="Previous Page"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2 text-[11px] font-medium text-foreground">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                            title="Next Page"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                            title="Last Page"
                        >
                            <ChevronsRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Shared pill used by every grid so the same verdict always looks the same. */
export const StatePill: React.FC<{
    tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'neutral';
    children: React.ReactNode;
}> = ({ tone, children }) => {
    const tones: Record<string, string> = {
        emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        rose: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
        blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
        neutral: 'bg-muted text-muted-foreground border border-border',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${tones[tone]}`}>
            {children}
        </span>
    );
};
