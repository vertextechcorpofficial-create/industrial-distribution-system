/**
 * Filter and Action Header Component for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Direct PDF/Print trigger calling formatted document generator with company header
 * - Search Product Description at start of row (Column 1)
 * - Industrial Branch selector (Column 2)
 * - Start Date & End Date pickers (Columns 3 & 4)
 * - Risk Band Filter (Column 5)
 * - Responsive toolbar with Refresh and AI Copilot trigger
 *
 * Loading contract: nothing here fetches on its own. The controls edit the draft filter,
 * Apply Filters hands that draft to the parent, and Refresh re-runs the applied scope.
 */

'use client';

import React, { useMemo } from 'react';
import { InventoryHealthFilter } from '../types';
import { Sparkles, Filter, RefreshCw, Printer, Search } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface FilterHeaderProps {
    filter: InventoryHealthFilter;
    onFilterChange: (newFilter: InventoryHealthFilter) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onRefresh: () => void;
    onApply: () => void;
    onToggleAi: () => void;
    onPrint: () => void;
    isAiLoading: boolean;
    isReportLoading: boolean;
    branches: Array<{ id: number; branch_name: string }>;
}

const RISK_BAND_OPTIONS = [
    { value: '', label: 'All Risk Bands' },
    { value: 'CRITICAL', label: 'Critical Stockout (<7d)' },
    { value: 'ELEVATED', label: 'Elevated Risk (7-14d)' },
    { value: 'MODERATE', label: 'Moderate Risk (15-30d)' },
    { value: 'HEALTHY', label: 'Healthy Stock (31-90d)' },
    { value: 'EXCESS', label: 'Excess Stock (>90d)' },
    { value: 'NO_DEMAND', label: 'No Demand / Unavailable' },
];

export const FilterHeader: React.FC<FilterHeaderProps> = ({
    filter,
    onFilterChange,
    searchTerm,
    onSearchChange,
    onRefresh,
    onApply,
    onToggleAi,
    onPrint,
    isAiLoading,
    isReportLoading,
    branches,
}) => {
    // Format branches into SearchableSelect option shape
    const branchOptions = useMemo(() => {
        return [
            { value: '', label: 'All Industrial Branches' },
            ...branches.map((b) => ({
                value: String(b.id),
                label: b.branch_name,
            })),
        ];
    }, [branches]);

    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Inventory Health Report</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Detects stockout vulnerabilities, cylinder fleet balance, coverage days, and dead stock with Gemini AI.
                    </p>
                </div>

                {/* Top Action Toolbar */}
                <div className="flex items-center flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onPrint}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-input rounded-lg bg-background hover:bg-muted text-foreground transition-colors shadow-2xs cursor-pointer"
                        title="Print or Export Formatted PDF with Company Header"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print / Export PDF
                    </button>

                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isReportLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-input rounded-lg bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isReportLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>

                    {/* AI Copilot Trigger with colored sparkle icon */}
                    <button
                        type="button"
                        onClick={onToggleAi}
                        disabled={isAiLoading || isReportLoading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                        <Sparkles className={`h-3.5 w-3.5 ${isAiLoading ? 'animate-spin text-amber-200' : 'text-amber-300'}`} />
                        {isAiLoading ? 'Gemini Analyzing...' : 'AI Copilot'}
                    </button>
                </div>
            </div>

            {/* Filter Controls Row: Searchbar is at Column 1, Branch at Column 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-border/60">
                {/* 1. Search Product Description at Start */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Search SKU</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Type product name/code..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                        />
                    </div>
                </div>

                {/* 2. Industrial Branch Searchable Select */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Branch</label>
                    <SearchableSelect
                        options={branchOptions}
                        value={filter.branchId ? String(filter.branchId) : ''}
                        onValueChange={(val) => onFilterChange({ ...filter, branchId: val || undefined })}
                        placeholder="All Industrial Branches"
                        className="h-9 text-xs"
                    />
                </div>

                {/* 3. Start Date */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Period From</label>
                    <input
                        type="date"
                        value={filter.startDate || ''}
                        onChange={(e) => onFilterChange({ ...filter, startDate: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                    />
                </div>

                {/* 4. End Date */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Period To</label>
                    <input
                        type="date"
                        value={filter.endDate || ''}
                        onChange={(e) => onFilterChange({ ...filter, endDate: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                    />
                </div>

                {/* 5. Risk Band Filter */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Risk Band</label>
                    <SearchableSelect
                        options={RISK_BAND_OPTIONS}
                        value={filter.riskBand || ''}
                        onValueChange={(val) => onFilterChange({ ...filter, riskBand: val || undefined })}
                        placeholder="All Risk Bands"
                        className="h-9 text-xs"
                    />
                </div>

                {/* 6. Apply Button: the only control that adopts the draft filter */}
                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={onApply}
                        disabled={isReportLoading}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors h-9 disabled:opacity-50 cursor-pointer shadow-xs"
                        title="Load the report for the filters selected above"
                    >
                        <Filter className="h-3.5 w-3.5" />
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};
