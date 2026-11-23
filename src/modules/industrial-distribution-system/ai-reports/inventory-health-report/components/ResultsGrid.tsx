/**
 * Results Grid Component for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Tabular representation of parent serialized industrial SKUs
 * - Separate display of Usable Full, Empty, Customer Held, and Defective cylinders
 * - Explicit "Unavailable" representation for Coverage Days when demand is 0
 * - Deterministic Risk Band badges (Critical, Elevated, Moderate, Healthy, Excess, No Demand)
 * - Interactive column sorting and client-side pagination (10, 25, 50, 100)
 * - Table-local row filter that narrows these rows only, including the risk band words on screen
 * - Complies with React Hook ordering rules (zero conditional useMemo)
 */

'use client';

import React, { useState, useMemo } from 'react';
import { SkuHealthRow, StockoutRiskBand } from '../types';
import { ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';

interface ResultsGridProps {
    skus: SkuHealthRow[];
    selectedProductId: number | null;
    onSelectSku: (sku: SkuHealthRow) => void;
    isLoading: boolean;
    searchTerm: string;
}

type SortField =
    | 'productName'
    | 'usableAvailableQuantity'
    | 'emptyQuantity'
    | 'customerHeldQuantity'
    | 'defectiveQuantity'
    | 'totalFleetQuantity'
    | 'averageDailyDemand'
    | 'coverageDays'
    | 'safetyStockRecommendation'
    | 'riskBand';

type SortDirection = 'asc' | 'desc';

/**
 * One frame for both sides of the filter comparison. A code such as NO_DEMAND or DEAD_STOCK must
 * still answer to the words a reader can see on screen, so separators fold to single spaces
 * before matching. The same frame is applied to the typed query, or "no demand" could never
 * match the stored value.
 */
const searchFrame = (value: unknown) =>
    String(value ?? '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const ResultsGrid: React.FC<ResultsGridProps> = ({
    skus,
    selectedProductId,
    onSelectSku,
    isLoading,
    searchTerm,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [query, setQuery] = useState('');

    const needle = searchFrame(query);

    // Filter SKUs by description, name, or code
    const filteredSkus = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return skus;
        return skus.filter(
            (s) =>
                s.productName.toLowerCase().includes(query) ||
                s.description.toLowerCase().includes(query) ||
                s.productCode.toLowerCase().includes(query)
        );
    }, [skus, searchTerm]);

    // Table-local narrowing, applied on top of the scope search. It reaches every field this grid
    // can show, so typing "critical" leaves only the critical-risk rows in view.
    const matchedSkus = useMemo(() => {
        if (!needle) return filteredSkus; // same array identity: an empty box must not restart anything
        return filteredSkus.filter((s) =>
            [s.productName, s.productCode, s.description, s.category, s.riskBand, s.agingCategory]
                .some((part) => searchFrame(part).includes(needle))
        );
    }, [filteredSkus, needle]);

    // Any change to the rows, the filter or the ordering restarts the reader at page 1; otherwise a
    // narrowed set can leave the old page number past the end and the grid reads as empty.
    const filtersKey = `${needle}_${searchTerm}_${String(sortField)}_${sortDirection}_${pageSize}_${skus.length}`;
    const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
    if (prevFiltersKey !== filtersKey) {
        setPrevFiltersKey(filtersKey);
        setCurrentPage(1);
    }

    // Sorting logic prioritizing critical risk SKUs by default
    const sortedSkus = useMemo(() => {
        const list = [...matchedSkus];

        if (sortField) {
            list.sort((a, b) => {
                let aVal: number | string | null = null;
                let bVal: number | string | null = null;

                if (sortField === 'productName') {
                    aVal = a.productName.toLowerCase();
                    bVal = b.productName.toLowerCase();
                } else if (sortField === 'usableAvailableQuantity') {
                    aVal = a.fleet.usableAvailableQuantity;
                    bVal = b.fleet.usableAvailableQuantity;
                } else if (sortField === 'emptyQuantity') {
                    aVal = a.fleet.emptyQuantity;
                    bVal = b.fleet.emptyQuantity;
                } else if (sortField === 'customerHeldQuantity') {
                    aVal = a.fleet.customerHeldQuantity;
                    bVal = b.fleet.customerHeldQuantity;
                } else if (sortField === 'defectiveQuantity') {
                    aVal = a.fleet.defectiveQuantity;
                    bVal = b.fleet.defectiveQuantity;
                } else if (sortField === 'totalFleetQuantity') {
                    aVal = a.fleet.totalFleetQuantity;
                    bVal = b.fleet.totalFleetQuantity;
                } else if (sortField === 'averageDailyDemand') {
                    aVal = a.averageDailyDemand;
                    bVal = b.averageDailyDemand;
                } else if (sortField === 'coverageDays') {
                    aVal = a.coverageDays;
                    bVal = b.coverageDays;
                } else if (sortField === 'safetyStockRecommendation') {
                    aVal = a.safetyStockRecommendation;
                    bVal = b.safetyStockRecommendation;
                } else if (sortField === 'riskBand') {
                    const weight: Record<StockoutRiskBand, number> = {
                        CRITICAL: 6,
                        ELEVATED: 5,
                        MODERATE: 4,
                        EXCESS: 3,
                        HEALTHY: 2,
                        NO_DEMAND: 1,
                    };
                    aVal = weight[a.riskBand] || 0;
                    bVal = weight[b.riskBand] || 0;
                }

                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default sort: Critical stockouts first, then elevated, then by total fleet
            list.sort((a, b) => {
                const weight: Record<StockoutRiskBand, number> = {
                    CRITICAL: 6,
                    ELEVATED: 5,
                    MODERATE: 4,
                    EXCESS: 3,
                    HEALTHY: 2,
                    NO_DEMAND: 1,
                };
                const weightDiff = (weight[b.riskBand] || 0) - (weight[a.riskBand] || 0);
                if (weightDiff !== 0) return weightDiff;
                return b.fleet.totalFleetQuantity - a.fleet.totalFleetQuantity;
            });
        }

        return list;
    }, [matchedSkus, sortField, sortDirection]);

    // Pagination calculations
    const totalRecords = sortedSkus.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const paginatedSkus = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedSkus.slice(start, start + pageSize);
    }, [sortedSkus, currentPage, pageSize]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-primary" />
        ) : (
            <ArrowDown className="h-3 w-3 text-primary" />
        );
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
            {/* Table Header Bar */}
            <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-foreground">Parent Serialized SKU Health Scorecards</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Evaluating {totalRecords} parent serialized product{totalRecords !== 1 ? 's' : ''} across industrial branches.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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

                    <span className="text-[11px] text-muted-foreground">Rows per page:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="text-xs border border-input bg-background rounded-lg px-2 py-1 h-8 focus:outline-hidden"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {/* Table Wrapper */}
            <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/50 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                            <th className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort('productName')}>
                                <div className="flex items-center gap-1.5">
                                    <span>Product Description (SKU)</span>
                                    {renderSortIcon('productName')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('usableAvailableQuantity')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>Usable Full</span>
                                    {renderSortIcon('usableAvailableQuantity')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('emptyQuantity')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>Empty</span>
                                    {renderSortIcon('emptyQuantity')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('customerHeldQuantity')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>Customer Held</span>
                                    {renderSortIcon('customerHeldQuantity')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('defectiveQuantity')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>Defective</span>
                                    {renderSortIcon('defectiveQuantity')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('totalFleetQuantity')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>Total Fleet</span>
                                    {renderSortIcon('totalFleetQuantity')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('averageDailyDemand')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>ADS (Sales)</span>
                                    {renderSortIcon('averageDailyDemand')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('coverageDays')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>Coverage Days</span>
                                    {renderSortIcon('coverageDays')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('safetyStockRecommendation')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>Safety Target</span>
                                    {renderSortIcon('safetyStockRecommendation')}
                                </div>
                            </th>
                            <th className="py-3 px-3 text-center cursor-pointer select-none" onClick={() => handleSort('riskBand')}>
                                <div className="flex items-center justify-center gap-1">
                                    <span>Risk Band</span>
                                    {renderSortIcon('riskBand')}
                                </div>
                            </th>
                            <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 text-foreground">
                        {isLoading ? (
                            <tr>
                                <td colSpan={11} className="py-12 text-center text-muted-foreground">
                                    <div className="inline-flex items-center gap-2">
                                        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        <span>Loading inventory health metrics...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedSkus.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="py-12 text-center text-muted-foreground">
                                    {/* A missed row filter and an empty period are different problems to fix. */}
                                    {needle && matchedSkus.length === 0 && filteredSkus.length > 0 ? (
                                        `No row in this table matches "${query.trim()}".`
                                    ) : (
                                        'No parent serialized SKUs match the current parameters.'
                                    )}
                                </td>
                            </tr>
                        ) : (
                            paginatedSkus.map((sku) => {
                                const isSelected = sku.productId === selectedProductId;

                                return (
                                    <tr
                                        key={sku.productId}
                                        className={`hover:bg-muted/50 transition-colors ${
                                            isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                                        }`}
                                    >
                                        {/* Product Description / Name (Column 1) */}
                                        <td className="py-3 px-4">
                                            <div className="font-semibold text-foreground text-xs leading-snug">
                                                {sku.productName}
                                            </div>

                                        </td>

                                        {/* Usable Full */}
                                        <td className="py-3 px-3 text-center">
                                            <span
                                                className={`font-bold tabular-nums ${
                                                    sku.fleet.usableAvailableQuantity === 0
                                                        ? 'text-rose-600 dark:text-rose-400'
                                                        : 'text-emerald-600 dark:text-emerald-400'
                                                }`}
                                            >
                                                {sku.fleet.usableAvailableQuantity.toLocaleString()}
                                            </span>
                                        </td>

                                        {/* Empty */}
                                        <td className="py-3 px-3 text-center tabular-nums text-muted-foreground">
                                            {sku.fleet.emptyQuantity.toLocaleString()}
                                        </td>

                                        {/* Customer Held */}
                                        <td className="py-3 px-3 text-center tabular-nums font-medium text-foreground">
                                            {sku.fleet.customerHeldQuantity.toLocaleString()}
                                        </td>

                                        {/* Defective */}
                                        <td className="py-3 px-3 text-center tabular-nums">
                                            {sku.fleet.defectiveQuantity > 0 ? (
                                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                                    {sku.fleet.defectiveQuantity}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/60">0</span>
                                            )}
                                        </td>

                                        {/* Total Fleet */}
                                        <td className="py-3 px-3 text-center font-bold tabular-nums text-foreground">
                                            {sku.fleet.totalFleetQuantity.toLocaleString()}
                                        </td>

                                        {/* Average Daily Demand (ADS) */}
                                        <td className="py-3 px-3 text-center tabular-nums font-mono text-[11px]">
                                            {sku.averageDailyDemand > 0 ? sku.averageDailyDemand.toFixed(1) : '0.0'}
                                        </td>

                                        {/* Coverage Days (Unavailable when ADS = 0) */}
                                        <td className="py-3 px-3 text-center">
                                            {sku.coverageDays !== null ? (
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                                                        sku.coverageDays < 7
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60'
                                                            : sku.coverageDays <= 14
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60'
                                                            : sku.coverageDays > 90
                                                            ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60'
                                                    }`}
                                                >
                                                    {sku.coverageDays} d
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border/80">
                                                    Unavailable
                                                </span>
                                            )}
                                        </td>

                                        {/* Safety Stock Recommendation */}
                                        <td className="py-3 px-3 text-center tabular-nums font-semibold text-foreground">
                                            {sku.safetyStockRecommendation.toLocaleString()}
                                        </td>

                                        {/* Risk Band Badge */}
                                        <td className="py-3 px-3 text-center">
                                            {sku.riskBand === 'CRITICAL' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                                                    CRITICAL
                                                </span>
                                            ) : sku.riskBand === 'ELEVATED' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                                    ELEVATED
                                                </span>
                                            ) : sku.riskBand === 'MODERATE' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                    MODERATE
                                                </span>
                                            ) : sku.riskBand === 'EXCESS' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                    EXCESS
                                                </span>
                                            ) : sku.riskBand === 'NO_DEMAND' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    NO DEMAND
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                    HEALTHY
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onSelectSku(sku)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                                            >
                                                <span>Details</span>
                                                <ChevronRight className="h-3 w-3" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <div>
                    Showing{' '}
                    <span className="font-semibold text-foreground">
                        {totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                    </span>{' '}
                    to{' '}
                    <span className="font-semibold text-foreground">
                        {Math.min(currentPage * pageSize, totalRecords)}
                    </span>{' '}
                    of <span className="font-semibold text-foreground">{totalRecords}</span> SKUs
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1 rounded-md border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors cursor-pointer"
                        title="First Page"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded-md border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors cursor-pointer"
                        title="Previous Page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="px-3 py-1 font-medium text-foreground">
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded-md border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors cursor-pointer"
                        title="Next Page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded-md border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors cursor-pointer"
                        title="Last Page"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
