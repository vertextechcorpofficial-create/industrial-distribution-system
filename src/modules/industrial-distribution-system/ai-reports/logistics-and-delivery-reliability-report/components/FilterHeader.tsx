/**
 * Filter and Action Header — Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Nothing is fetched from this bar until Apply is pressed; the controls edit a draft filter only
 *   (project convention for report modules: an auto-loaded window looks like a deliberate answer).
 * - Tolerance is a measurement rule, so it sits with the dates rather than inside a grid.
 * - This component is CONTROLLED: `filter` comes from the parent page via props. The parent owns the
 *   default (current calendar month, via buildDefaultFilter) and the Reset handler. An earlier draft kept a
 *   local useState copy here, which froze every input because onFilterChange never updated it.
 * - Tolerance fallback now uses DEFAULT_ON_TIME_TOLERANCE_MINUTES (60) instead of a hard-coded 15,
 *   so the dropdown agrees with the methodology text and the headline figures.
 */

'use client';

import React, { useMemo } from 'react'; // useState no longer needed: state lives in the parent
import { LogisticsReportFilter } from '../types';
import { TOLERANCE_OPTIONS, DEFAULT_ON_TIME_TOLERANCE_MINUTES } from '../services/logisticsMetrics';
import { Sparkles, Filter, RefreshCw, Printer, Search, RotateCcw } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface FilterHeaderProps {
    filter: LogisticsReportFilter;
    onFilterChange: (next: LogisticsReportFilter) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onApply: () => void;
    onRefresh: () => void;
    onReset: () => void;
    onPrint: () => void;
    onToggleAi: () => void;
    isAiLoading: boolean;
    isReportLoading: boolean;
    hasReport: boolean;
    branches: Array<{ id: number; branch_name: string }>;
    products: Array<{ id: number; description: string }>;
}

export const FilterHeader: React.FC<FilterHeaderProps> = ({
    filter, // restored: the draft filter is owned by the parent and passed down
    onFilterChange,
    searchTerm,
    onSearchChange,
    onApply,
    onRefresh,
    onReset,
    onPrint,
    onToggleAi,
    isAiLoading,
    isReportLoading,
    hasReport,
    branches,
    products,
}) => {
    const branchOptions = useMemo(
        () => [
            { value: '', label: 'All Industrial Branches' },
            ...branches.map((b) => ({ value: String(b.id), label: b.branch_name })),
        ],
        [branches]
    );

    const productOptions = useMemo(
        () => [
            { value: '', label: 'All Products' },
            ...products.map((p) => ({ value: String(p.id), label: p.description })),
        ],
        [products]
    );

    const toleranceOptions = useMemo(
        () => TOLERANCE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
        []
    );

    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Logistics and Delivery Reliability Report</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Arrival accuracy, route reliability, late-trip evidence and fleet activity for posted industrial dispatches.
                    </p>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onPrint}
                        disabled={!hasReport}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-input rounded-lg bg-background hover:bg-muted text-foreground transition-colors shadow-2xs disabled:opacity-40"
                        title="Open the browser print dialog — choose Save as PDF as the destination to export. Paper, orientation and margins come from the report layout."
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print / Export PDF
                    </button>

                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isReportLoading || !hasReport}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-input rounded-lg bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-40"
                        title="Re-run the same filters"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isReportLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>

                    <button
                        type="button"
                        onClick={onToggleAi}
                        disabled={isAiLoading || isReportLoading || !hasReport}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-xs transition-all disabled:opacity-40"
                    >
                        <Sparkles className={`h-3.5 w-3.5 ${isAiLoading ? 'animate-spin text-amber-200' : 'text-amber-300'}`} />
                        {isAiLoading ? 'Analyzing...' : 'AI Insight'}
                    </button>
                </div>
            </div>

            {/* Filter Controls: 2 Balanced, Spacious Rows */}
            <div className="space-y-3 pt-3 border-t border-border/60">
                {/* Row 1: Search & Scopes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    {/* 1. Free-text search across trip, customer, plate and driver */}
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Search Trips</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search trip no, customer, plate, driver..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                            />
                        </div>
                    </div>

                    {/* 2. Origin branch */}
                    <div className="sm:col-span-1 lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Branches</label>
                        <SearchableSelect
                            options={branchOptions}
                            value={filter.branchId ? String(filter.branchId) : ''}
                            onValueChange={(val) => onFilterChange({ ...filter, branchId: val || undefined })}
                            placeholder="All Industrial Branches"
                            className="h-9 text-xs"
                        />
                    </div>

                    {/* 3. Product */}
                    <div className="sm:col-span-1 lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Products</label>
                        <SearchableSelect
                            options={productOptions}
                            value={filter.productId ? String(filter.productId) : ''}
                            onValueChange={(val) => onFilterChange({ ...filter, productId: val || undefined })}
                            placeholder="All Products"
                            className="h-9 text-xs"
                        />
                    </div>
                </div>

                {/* Row 2: Period Dates, Tolerance & Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    {/* 4. Start date */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Period Start</label>
                        <input
                            type="date"
                            value={filter.startDate || ''}
                            onChange={(e) => onFilterChange({ ...filter, startDate: e.target.value })}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                        />
                    </div>

                    {/* 5. End date */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Period End</label>
                        <input
                            type="date"
                            value={filter.endDate || ''}
                            onChange={(e) => onFilterChange({ ...filter, endDate: e.target.value })}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                        />
                    </div>

                    {/* 6. Tolerance window (fallback follows the shared default, not a hard-coded 15) */}
                    <div className="lg:col-span-1">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">On-time Tolerance</label>
                        <SearchableSelect
                            options={toleranceOptions}
                            value={String(filter.toleranceMinutes ?? DEFAULT_ON_TIME_TOLERANCE_MINUTES)}
                            onValueChange={(val) => onFilterChange({ ...filter, toleranceMinutes: Number(val) })}
                            placeholder="1 hour (standard)"
                            className="h-9 text-xs"
                        />
                    </div>

                    {/* 7. Action buttons (Apply & Reset). Reset is handled by the parent (onReset). */}
                    <div className="lg:col-span-1 flex items-end gap-1.5">
                        <button
                            type="button"
                            onClick={onApply}
                            disabled={isReportLoading}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors h-9 disabled:opacity-50 shadow-xs"
                            title="Apply selected filters"
                        >
                            <Filter className="h-3.5 w-3.5" />
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={onReset}
                            className="inline-flex items-center justify-center p-2 text-xs font-medium rounded-lg border border-input bg-background hover:bg-muted text-foreground transition-colors h-9 w-9 shrink-0 shadow-2xs"
                            title="Reset filters to default"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};