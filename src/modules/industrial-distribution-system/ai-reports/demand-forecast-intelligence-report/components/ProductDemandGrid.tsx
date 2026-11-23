/**
 * Product Demand Grid Component - Demand Forecast & Inventory Alignment Table
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Smart Sorting: Sort by Demand Qty, Coverage %, Stock On-Hand, or Product Name
 * - Search Filter: Filters across product description and branch name
 * - Table-local row filter: narrows these rows only, and reaches the runway status on screen
 * - Visual Status Badges: UNDERSUPPLIED (rose), BALANCED (emerald), OVERSUPPLIED (amber), NO_DATA (muted)
 * - Serial Breakdown: Full vs Empty vs Total On-Hand columns from live v_serial_onhand
 * - Client-side Pagination (10, 25, 50, 100)
 * - Selection callback to inspect product details or monthly trend
 * - Unconditional hooks at top of component (Strict adherence to React Rules of Hooks)
 */

'use client';

import React, { useState, useMemo } from 'react';
import { ProductDemandRow } from '../types';
import {
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Package,
    Layers,
    Search,
} from 'lucide-react';

interface ProductDemandGridProps {
    products: ProductDemandRow[];
    selectedProductId: number | null;
    onSelectProduct?: (product: ProductDemandRow) => void;
    isLoading: boolean;
    searchTerm: string;
}

type SortField =
    | 'productName'
    | 'branchName'
    | 'totalDemandQty'
    | 'dailyBurnRate'
    | 'stockOnHandFull'
    | 'forecast7Day'
    | 'projected30DayDemand'
    | 'daysOfSupply'
    | 'stockoutDaysRemaining'
    | 'suggestedReplenishment'
    | 'runwayStatus';

type SortDirection = 'asc' | 'desc';

/**
 * One frame for both sides of the filter comparison. A stored value such as CRITICAL_STOCKOUT must
 * still answer to the badge word a reader sees on screen, so separators fold to single spaces
 * before matching. The same frame is applied to the typed query, or "no demand" could never match
 * the stored value.
 */
const searchFrame = (value: unknown) =>
    String(value ?? '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const ProductDemandGrid: React.FC<ProductDemandGridProps> = ({
    products,
    selectedProductId,
    onSelectProduct,
    isLoading,
    searchTerm,
}) => {
    // Unconditional state hooks
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [sortField, setSortField] = useState<SortField | null>('totalDemandQty');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [query, setQuery] = useState('');

    const needle = searchFrame(query);

    // Reset page to 1 when filters or sort change
    const [prevFiltersKey, setPrevFiltersKey] = useState(
        `${searchTerm}_${needle}_${sortField}_${sortDirection}_${products.length}`
    );
    const currentFiltersKey = `${searchTerm}_${needle}_${sortField}_${sortDirection}_${products.length}`;

    if (currentFiltersKey !== prevFiltersKey) {
        setPrevFiltersKey(currentFiltersKey);
        setCurrentPage(1);
    }

    // Filter products by search term (unconditional hook)
    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) return products;
        const lower = searchTerm.toLowerCase();
        return products.filter(
            (p) =>
                p.productName.toLowerCase().includes(lower) ||
                (p.branchName && p.branchName.toLowerCase().includes(lower))
        );
    }, [products, searchTerm]);

    // Table-local narrowing, applied on top of the scope search. It reaches the runway status, so
    // typing "critical" or "surplus" leaves only those rows in view.
    const matchedProducts = useMemo(() => {
        if (!needle) return filteredProducts; // same array identity: an empty box must not restart anything
        return filteredProducts.filter((p) =>
            [p.productName, p.branchName, p.runwayStatus]
                .some((part) => searchFrame(part).includes(needle))
        );
    }, [filteredProducts, needle]);

    // Sort products (unconditional hook)
    const sortedProducts = useMemo(() => {
        const list = [...matchedProducts];

        if (sortField) {
            list.sort((a, b) => {
                let aVal: string | number | null = a[sortField];
                let bVal: string | number | null = b[sortField];

                if (sortField === 'runwayStatus') {
                    const weight: Record<string, number> = {
                        CRITICAL_STOCKOUT: 5,
                        LOW_RUNWAY: 4,
                        BALANCED: 3,
                        SURPLUS: 2,
                        NO_DEMAND: 1,
                    };
                    aVal = weight[a.runwayStatus] ?? 0;
                    bVal = weight[b.runwayStatus] ?? 0;
                }

                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return list;
    }, [matchedProducts, sortField, sortDirection]);

    // Pagination calculations (unconditional hooks)
    const totalPages = Math.ceil(sortedProducts.length / pageSize) || 1;
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedProducts.slice(start, start + pageSize);
    }, [sortedProducts, currentPage, pageSize]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3 w-3 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-foreground" />
        ) : (
            <ArrowDown className="h-3 w-3 text-foreground" />
        );
    };

    if (isLoading) {
        return (
            <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4">
                <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-12 bg-muted/40 animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            {/* Header / Meta Bar */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <h2 className="text-sm font-bold text-foreground">Demand Forecast &amp; Inventory Runway</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                        {sortedProducts.length} Evaluated
                    </span>
                </div>

                {/* Table-local filter: narrows these rows only, never the period or the branch. */}
                <div className="relative w-full sm:w-56 shrink-0">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Filter rows in this table"
                        placeholder="Filter rows in this table"
                        className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                            <th className="py-3 px-3 text-center w-10">#</th>

                            {/* Product Name */}
                            <th
                                onClick={() => handleSort('productName')}
                                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>Product Description</span>
                                    {renderSortIcon('productName')}
                                </div>
                            </th>

                            {/* Branch Name */}
                            <th
                                onClick={() => handleSort('branchName')}
                                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>Branch</span>
                                    {renderSortIcon('branchName')}
                                </div>
                            </th>

                            {/* Daily Burn Rate */}
                            <th
                                onClick={() => handleSort('dailyBurnRate')}
                                className="py-3 px-3 text-right cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center justify-end gap-1.5">
                                    <span>Daily Burn</span>
                                    {renderSortIcon('dailyBurnRate')}
                                </div>
                            </th>

                            {/* Full On-Hand Stock (Usable inventory only) */}
                            <th
                                onClick={() => handleSort('stockOnHandFull')}
                                className="py-3 px-3 text-right cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center justify-end gap-1.5">
                                    <span className="text-emerald-600 dark:text-emerald-400">Full Stock</span>
                                    {renderSortIcon('stockOnHandFull')}
                                </div>
                            </th>

                            {/* Next 7-Day Forecast */}
                            <th
                                onClick={() => handleSort('forecast7Day')}
                                className="py-3 px-3 text-right cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center justify-end gap-1.5">
                                    <span className="text-amber-600 dark:text-amber-400">7D Forecast</span>
                                    {renderSortIcon('forecast7Day')}
                                </div>
                            </th>

                            {/* Next 30-Day Forecast */}
                            <th
                                onClick={() => handleSort('projected30DayDemand')}
                                className="py-3 px-3 text-right cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center justify-end gap-1.5">
                                    <span className="text-sky-600 dark:text-sky-400">30D Forecast</span>
                                    {renderSortIcon('projected30DayDemand')}
                                </div>
                            </th>

                            {/* Stock Runway (Days of Supply) */}
                            <th
                                onClick={() => handleSort('daysOfSupply')}
                                className="py-3 px-3 text-center cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center justify-center gap-1.5">
                                    <span>Runway</span>
                                    {renderSortIcon('daysOfSupply')}
                                </div>
                            </th>

                            {/* Estimated Stockout Date */}
                            <th
                                onClick={() => handleSort('stockoutDaysRemaining')}
                                className="py-3 px-3 text-center cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center justify-center gap-1.5">
                                    <span>Est. Stockout</span>
                                    {renderSortIcon('stockoutDaysRemaining')}
                                </div>
                            </th>

                            {/* Suggested Reorder Replenishment */}
                            <th
                                onClick={() => handleSort('suggestedReplenishment')}
                                className="py-3 px-3 text-right cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center justify-end gap-1.5">
                                    <span>Reorder Qty</span>
                                    {renderSortIcon('suggestedReplenishment')}
                                </div>
                            </th>

                            {/* Forecast & Stock Status */}
                            <th
                                onClick={() => handleSort('runwayStatus')}
                                className="py-3 px-3 text-center cursor-pointer hover:text-foreground transition-colors group"
                            >
                                <div className="flex items-center justify-center gap-1.5">
                                    <span>Status</span>
                                    {renderSortIcon('runwayStatus')}
                                </div>
                            </th>

                            <th className="py-3 px-3 text-center w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {paginatedProducts.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="py-12 text-center text-muted-foreground">
                                    <Layers className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                                    {/* A missed row filter and an empty period are different problems to fix. */}
                                    {needle && matchedProducts.length === 0 && filteredProducts.length > 0 ? (
                                        `No row in this table matches "${query.trim()}".`
                                    ) : (
                                        'No demand records found matching the active filters.'
                                    )}
                                </td>
                            </tr>
                        ) : (
                            paginatedProducts.map((p, idx) => {
                                const isSelected = selectedProductId === p.productId;
                                const rowNum = (currentPage - 1) * pageSize + idx + 1;

                                const runwayDisplay =
                                    p.daysOfSupply >= 999
                                        ? '>90 d'
                                        : `${p.daysOfSupply} d`;

                                const renderStockoutDate = () => {
                                    if (p.runwayStatus === 'NO_DEMAND') {
                                        return <span className="text-muted-foreground text-[10px]">No Depletion</span>;
                                    }
                                    if (p.stockOnHandFull === 0) {
                                        return (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                                Immediate (0d)
                                            </span>
                                        );
                                    }
                                    if (p.stockoutDaysRemaining !== null && p.stockoutDaysRemaining !== undefined) {
                                        if (p.stockoutDaysRemaining >= 90) {
                                            return <span className="text-muted-foreground font-medium">&gt;90 days</span>;
                                        }
                                        const formattedDate = p.estimatedStockoutDate
                                            ? new Date(p.estimatedStockoutDate + 'T00:00:00').toLocaleDateString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric',
                                              })
                                            : '';
                                        const isCritical = p.stockoutDaysRemaining < 7;
                                        const isLow = p.stockoutDaysRemaining < 15;

                                        return (
                                            <div className="flex flex-col items-center">
                                                <span
                                                    className={`font-bold ${
                                                        isCritical
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : isLow
                                                            ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-foreground'
                                                    }`}
                                                >
                                                    {formattedDate}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    ({p.stockoutDaysRemaining}d left)
                                                </span>
                                            </div>
                                        );
                                    }
                                    return <span className="text-muted-foreground text-[10px]">Safe</span>;
                                };

                                return (
                                    <tr
                                        key={`${p.productId}-${p.branchId ?? 'all'}`}
                                        onClick={() => onSelectProduct && onSelectProduct(p)}
                                        className={`hover:bg-muted/50 transition-colors cursor-pointer ${
                                            isSelected ? 'bg-primary/5 font-medium' : ''
                                        }`}
                                    >
                                        <td className="py-3 px-3 text-center text-muted-foreground">{rowNum}</td>

                                        {/* Product Name */}
                                        <td className="py-3 px-3">
                                            <div className="font-semibold text-foreground">{p.productName}</div>
                                            <div className="text-[10px] text-muted-foreground">ID: {p.productId}</div>
                                        </td>

                                        {/* Branch */}
                                        <td className="py-3 px-3 text-muted-foreground">
                                            {p.branchName || 'All Branches'}
                                        </td>

                                        {/* Daily Burn Rate */}
                                        <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                                            {p.dailyBurnRate.toFixed(2)} /d
                                        </td>

                                        {/* Full Stock On-Hand (Usable inventory only) */}
                                        <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                            {p.stockOnHandFull.toLocaleString()}
                                        </td>

                                        {/* Next 7-Day Demand Forecast */}
                                        <td className="py-3 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                                            {p.forecast7Day.toLocaleString()}
                                        </td>

                                        {/* Next 30-Day Demand Forecast */}
                                        <td className="py-3 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                            {p.projected30DayDemand.toLocaleString()}
                                        </td>

                                        {/* Runway (Days of Supply) */}
                                        <td className="py-3 px-3 text-center font-bold">
                                            <span
                                                className={
                                                    p.runwayStatus === 'CRITICAL_STOCKOUT'
                                                        ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                                                        : p.runwayStatus === 'LOW_RUNWAY'
                                                        ? 'text-amber-600 dark:text-amber-400'
                                                        : p.runwayStatus === 'BALANCED'
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-muted-foreground'
                                                }
                                            >
                                                {runwayDisplay}
                                            </span>
                                        </td>

                                        {/* Estimated Stockout Date */}
                                        <td className="py-3 px-3 text-center">
                                            {renderStockoutDate()}
                                        </td>

                                        {/* Suggested Reorder Replenishment */}
                                        <td className="py-3 px-3 text-right font-bold">
                                            {p.suggestedReplenishment > 0 ? (
                                                <span className="text-rose-600 dark:text-rose-400">
                                                    +{p.suggestedReplenishment.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </td>

                                        {/* Status Badge */}
                                        <td className="py-3 px-3 text-center">
                                            {p.runwayStatus === 'CRITICAL_STOCKOUT' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                    CRITICAL (&lt;7d)
                                                </span>
                                            )}
                                            {p.runwayStatus === 'LOW_RUNWAY' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                    LOW (7-14d)
                                                </span>
                                            )}
                                            {p.runwayStatus === 'BALANCED' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    BALANCED
                                                </span>
                                            )}
                                            {p.runwayStatus === 'SURPLUS' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                                    SURPLUS (&gt;45d)
                                                </span>
                                            )}
                                            {p.runwayStatus === 'NO_DEMAND' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                                                    NO DEMAND
                                                </span>
                                            )}
                                        </td>

                                        <td className="py-3 px-3 text-center text-muted-foreground">
                                            <ChevronRight className="h-4 w-4" />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Pagination & Rows Per Page Bar */}
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/10">
                <div className="flex items-center gap-4">
                    <div>
                        {sortedProducts.length === 0
                            ? 'Showing 0 entries'
                            : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(
                                  currentPage * pageSize,
                                  sortedProducts.length
                              )} of ${sortedProducts.length} entries`}
                    </div>

                    {/* Rows per page selector moved to bottom alongside entries */}
                    <div className="flex items-center gap-1.5 border-l border-border/80 pl-4">
                        <span>Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="text-xs px-2 py-1 rounded-md border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                {/* Page Navigation Buttons */}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="First page"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Previous page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 font-medium text-foreground">
                        Page {currentPage} of {Math.max(1, totalPages)}
                    </span>
                    <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Next page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Last page"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
