/**
 * Filter Header Component for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Bounded Warehouse/Branch selector width placed FIRST on the controls row
 * - Operational Shift placed second
 * - Date Range Preset placed third (directly before Apply Filters)
 * - Conditional custom date inputs shown adjacent to date range
 * - Visual cue on Apply Filters button when draft differs from applied state
 * - Active Filter Summary Bar with filter tags and "Reset to Default" button
 * - Theme-compliant primary styling for AI Copilot button
 */

'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
    WarehouseEfficiencyFilter,
    ShiftType,
    DateRangePreset,
} from '../types';
import {
    RefreshCw,
    Sparkles,
    Printer,
    SlidersHorizontal,
    Calendar,
    RotateCcw,
} from 'lucide-react';

interface FilterHeaderProps {
    filter: WarehouseEfficiencyFilter;
    appliedFilter: WarehouseEfficiencyFilter;
    onChange: (next: WarehouseEfficiencyFilter) => void;
    onApply: () => void;
    onRefresh: () => void;
    onReset: () => void;
    onPrint: () => void;
    onOpenAiCopilot: () => void;
    branches: Array<{ id: number; branch_name: string; branch_code: string }>;
    isLoading: boolean;
    isAiLoading: boolean;
}

export function formatToMMDDYYYY(isoDate?: string): string {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${month}-${day}-${year}`;
    }
    return isoDate;
}

export function computePresetDateRange(preset: DateRangePreset): { startDate: string; endDate: string } {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const now = new Date();

    switch (preset) {
        case 'today':
            return { startDate: today, endDate: today };
        case 'this_week': {
            const dayOfWeek = now.getDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            const mondayIso = monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            return { startDate: mondayIso, endDate: today };
        }
        case 'this_month': {
            const startOfMonth = `${today.slice(0, 7)}-01`;
            return { startDate: startOfMonth, endDate: today };
        }
        case 'this_year': {
            const startOfYear = `${today.slice(0, 4)}-01-01`;
            return { startDate: startOfYear, endDate: today };
        }
        case 'custom':
        default:
            return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
    }
}

export const FilterHeader: React.FC<FilterHeaderProps> = ({
    filter,
    appliedFilter,
    onChange,
    onApply,
    onRefresh,
    onReset,
    onPrint,
    onOpenAiCopilot,
    branches,
    isLoading,
    isAiLoading,
}) => {
    const activePreset: DateRangePreset = filter.datePreset || 'this_month';

    // Check if draft has unapplied changes
    const hasUnappliedChanges = useMemo(() => {
        return (
            filter.branchId !== appliedFilter.branchId ||
            filter.shift !== appliedFilter.shift ||
            filter.datePreset !== appliedFilter.datePreset ||
            filter.startDate !== appliedFilter.startDate ||
            filter.endDate !== appliedFilter.endDate
        );
    }, [filter, appliedFilter]);

    // Check if filters differ from default
    const isFiltered = useMemo(() => {
        return (
            Boolean(appliedFilter.branchId) ||
            (appliedFilter.shift && appliedFilter.shift !== 'ALL') ||
            (appliedFilter.datePreset && appliedFilter.datePreset !== 'this_month')
        );
    }, [appliedFilter]);

    // Branch options for SearchableSelect
    const branchOptions = useMemo(() => {
        return [
            { value: '', label: 'All Authorized Branches' },
            ...branches.map((b) => ({
                value: String(b.id),
                label: `${b.branch_name} (${b.branch_code})`,
            })),
        ];
    }, [branches]);

    // Preset options for SearchableSelect
    const presetOptions = useMemo(() => [
        { value: 'today', label: 'Today' },
        { value: 'this_week', label: 'This Week' },
        { value: 'this_month', label: 'This Month' },
        { value: 'this_year', label: 'This Year' },
        { value: 'custom', label: 'Custom Date Range' },
    ], []);

    // Shift options for SearchableSelect
    const shiftOptions = useMemo(() => [
        { value: 'ALL', label: 'All Shifts' },
        { value: 'MORNING', label: 'Morning (06:00 - 14:00)' },
        { value: 'AFTERNOON', label: 'Afternoon (14:00 - 22:00)' },
        { value: 'NIGHT', label: 'Night (22:00 - 06:00)' },
    ], []);

    const handlePresetChange = (nextPreset: string) => {
        const preset = nextPreset as DateRangePreset;
        if (preset === 'custom') {
            onChange({
                ...filter,
                datePreset: 'custom',
            });
        } else {
            const { startDate, endDate } = computePresetDateRange(preset);
            onChange({
                ...filter,
                datePreset: preset,
                startDate,
                endDate,
            });
        }
    };

    const selectedBranchName = useMemo(() => {
        if (!appliedFilter.branchId) return null;
        const found = branches.find((b) => String(b.id) === String(appliedFilter.branchId));
        return found ? found.branch_name : null;
    }, [appliedFilter.branchId, branches]);

    return (
        <div className="bg-card border rounded-xl p-5 space-y-4 shadow-xs">
            {/* Top Bar: Title & Action Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">
                        Warehouse Efficiency Intelligence Report
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Fulfillment bottleneck analytics, dock bay turnaround times, space utilization, and picker productivity.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onPrint}
                        className="gap-1.5 h-8 text-xs font-medium"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print / Export
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="gap-1.5 h-8 text-xs font-medium"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>

                    <Button
                        variant="default"
                        size="sm"
                        onClick={onOpenAiCopilot}
                        disabled={isAiLoading}
                        className="gap-1.5 h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        {isAiLoading ? 'Analyzing...' : 'AI Copilot'}
                    </Button>
                </div>
            </div>

            {/* Bottom Controls Row: Reordered per revision request */}
            <div className="pt-3 border-t border-border/60">
                <div className="flex flex-wrap items-end gap-3">
                    {/* 1. Warehouse / Branch - FIRST with bounded width */}
                    <div className="w-full sm:w-[250px] md:w-[260px] shrink-0">
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                            Warehouse / Branch
                        </label>
                        <SearchableSelect
                            options={branchOptions}
                            value={filter.branchId ? String(filter.branchId) : ''}
                            onValueChange={(val) =>
                                onChange({ ...filter, branchId: val ? val : undefined })
                            }
                            placeholder="All Authorized Branches"
                            className="h-9 text-xs"
                        />
                    </div>

                    {/* 2. Operational Shift - SECOND */}
                    <div className="w-full sm:w-[180px] md:w-[190px] shrink-0">
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                            Operational Shift
                        </label>
                        <SearchableSelect
                            options={shiftOptions}
                            value={filter.shift || 'ALL'}
                            onValueChange={(val) =>
                                onChange({ ...filter, shift: (val || 'ALL') as ShiftType })
                            }
                            placeholder="All Shifts"
                            className="h-9 text-xs"
                        />
                    </div>

                    {/* 3. Date Range Preset - THIRD (before Apply Filters) */}
                    <div className="w-full sm:w-[170px] md:w-[180px] shrink-0">
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                            Date Range
                        </label>
                        <SearchableSelect
                            options={presetOptions}
                            value={activePreset}
                            onValueChange={handlePresetChange}
                            placeholder="Select date range..."
                            className="h-9 text-xs"
                        />
                    </div>

                    {/* Conditional Date Pickers: Only rendered when Custom is selected */}
                    {activePreset === 'custom' && (
                        <>
                            <div className="w-[140px] shrink-0">
                                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                    Period From
                                </label>
                                <Input
                                    type="date"
                                    value={filter.startDate || ''}
                                    onChange={(e) => onChange({ ...filter, startDate: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="w-[140px] shrink-0">
                                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                    Period To
                                </label>
                                <Input
                                    type="date"
                                    value={filter.endDate || ''}
                                    onChange={(e) => onChange({ ...filter, endDate: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                        </>
                    )}

                    {/* 4. Apply Filters Button with Visual Cue for Unapplied Draft Changes */}
                    <div className="flex-initial">
                        <Button
                            onClick={onApply}
                            disabled={isLoading}
                            size="sm"
                            className={`h-9 text-xs font-semibold px-4 gap-1.5 transition-all relative ${
                                hasUnappliedChanges
                                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground ring-2 ring-primary/40 shadow-sm'
                                    : ''
                            }`}
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            {hasUnappliedChanges ? 'Apply Changes' : 'Apply Filters'}
                            {hasUnappliedChanges && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Visual Cue: Active Filter Summary Bar with Reset Button */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2.5 mt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            Active Window: <strong className="text-foreground">{formatToMMDDYYYY(appliedFilter.startDate)}</strong> to <strong className="text-foreground">{formatToMMDDYYYY(appliedFilter.endDate)}</strong>
                        </span>

                        {selectedBranchName && (
                            <Badge variant="secondary" className="text-[10px] font-medium py-0 h-5 gap-1">
                                Branch: {selectedBranchName}
                            </Badge>
                        )}

                        {appliedFilter.shift && appliedFilter.shift !== 'ALL' && (
                            <Badge variant="secondary" className="text-[10px] font-medium py-0 h-5 gap-1">
                                Shift: {appliedFilter.shift}
                            </Badge>
                        )}

                        {hasUnappliedChanges && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold italic text-[10px]">
                                (Unapplied filter changes pending)
                            </span>
                        )}
                    </div>

                    {isFiltered && (
                        <button
                            type="button"
                            onClick={onReset}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset to Default
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
