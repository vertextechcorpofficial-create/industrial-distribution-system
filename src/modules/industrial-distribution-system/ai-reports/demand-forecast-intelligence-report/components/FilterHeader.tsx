/**
 * Filter and Action Header Component for Demand Forecast Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Local draft state for filters (branch, product, start/end dates)
 * - ONLY applies filters when the user explicitly clicks the "Apply Filters" or "Refresh" button
 * - Defaults start date and end date to the current month
 * - Product search bar (instant client-side filter)
 * - Top Action Toolbar: Print/Export PDF, Refresh, and AI Copilot Trigger
 * - Strict adherence to React Rules of Hooks (all hooks unconditional at component top)
 */

'use client';

import React, { useState, useMemo } from 'react';
import { DemandForecastFilter } from '../types';
import { Sparkles, Filter, RefreshCw, Printer, Search } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface FilterHeaderProps {
    initialFilter: DemandForecastFilter;
    onApplyFilter: (appliedFilter: DemandForecastFilter) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onToggleAi: () => void;
    onPrint: () => void;
    isAiLoading: boolean;
    isReportLoading: boolean;
    branches: Array<{ id: number; branch_name: string }>;
    productsList: Array<{ product_id: number; description: string }>;
}

export const FilterHeader: React.FC<FilterHeaderProps> = ({
    initialFilter,
    onApplyFilter,
    searchTerm,
    onSearchChange,
    onToggleAi,
    onPrint,
    isAiLoading,
    isReportLoading,
    branches,
    productsList,
}) => {
    // Local draft filter state — only committed when "Apply Filters" or "Refresh" is clicked
    const [draftFilter, setDraftFilter] = useState<DemandForecastFilter>(initialFilter);

    // Branch options for SearchableSelect (unconditional hook)
    const branchOptions = useMemo(() => {
        return [
            { value: '', label: 'All Branches' },
            ...branches.map((b) => ({
                value: String(b.id),
                label: b.branch_name,
            })),
        ];
    }, [branches]);

    // Product options for SearchableSelect (unconditional hook, using description as product name)
    const productOptions = useMemo(() => {
        return [
            { value: '', label: 'All Products' },
            ...productsList.map((p) => ({
                value: String(p.product_id),
                label: p.description,
            })),
        ];
    }, [productsList]);

    const handleApply = () => {
        onApplyFilter(draftFilter);
    };

    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    {/* Clean Title */}
                    <h1 className="text-xl font-bold text-foreground">Demand Forecast Intelligence Report</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Analyzes sales order demand velocity, PO replenishment coverage, and stock alignment with Gemini AI.
                    </p>
                </div>

                {/* Top Action Toolbar */}
                <div className="flex items-center flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onPrint}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-input rounded-lg bg-background hover:bg-muted text-foreground transition-colors shadow-2xs"
                        title="Print or Export Formatted PDF with Company Header"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print / Export PDF
                    </button>

                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={isReportLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-input rounded-lg bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isReportLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>

                    {/* AI Copilot Trigger */}
                    <button
                        type="button"
                        onClick={onToggleAi}
                        disabled={isAiLoading || isReportLoading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-xs transition-all disabled:opacity-50"
                    >
                        <Sparkles className={`h-3.5 w-3.5 ${isAiLoading ? 'animate-spin text-amber-200' : 'text-amber-300'}`} />
                        {isAiLoading ? 'Gemini Analyzing...' : 'AI Copilot'}
                    </button>
                </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-border/60">
                {/* 1. Client Search Bar */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Search Product</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Filter by name..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                        />
                    </div>
                </div>

                {/* 2. Branch Dropdown (staged in draftFilter) */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Branch</label>
                    <SearchableSelect
                        options={branchOptions}
                        value={draftFilter.branchId ? String(draftFilter.branchId) : ''}
                        onValueChange={(val) => setDraftFilter((prev) => ({ ...prev, branchId: val || undefined }))}
                        placeholder="All Branches"
                        className="h-9 text-xs"
                    />
                </div>

                {/* 3. Product Dropdown (staged in draftFilter) */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Product Filter</label>
                    <SearchableSelect
                        options={productOptions}
                        value={draftFilter.productId ? String(draftFilter.productId) : ''}
                        onValueChange={(val) => setDraftFilter((prev) => ({ ...prev, productId: val || undefined }))}
                        placeholder="All Products"
                        className="h-9 text-xs"
                    />
                </div>

                {/* 4. Start Date (staged in draftFilter) */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Start Date</label>
                    <input
                        type="date"
                        value={draftFilter.startDate || ''}
                        onChange={(e) => setDraftFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                    />
                </div>

                {/* 5. End Date (staged in draftFilter) */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">End Date</label>
                    <input
                        type="date"
                        value={draftFilter.endDate || ''}
                        onChange={(e) => setDraftFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                    />
                </div>

                {/* 6. Apply Button — commits draftFilter */}
                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={isReportLoading}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors h-9 shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                        <Filter className="h-3.5 w-3.5" />
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};
