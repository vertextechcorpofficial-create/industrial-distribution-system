/**
 * Detail Drawer Component for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Spacious layout (sm:max-w-xl md:max-w-2xl lg:max-w-3xl) to eliminate squished content
 * - Comprehensive metrics display (Pick Rate, Pack Rate, Labor, Dock Turnaround, Space Utilization)
 * - Visual progress indicators for space and dock capacity
 * - Transactional evidence links and calculation basis footnotes
 */

'use client';

import React from 'react';
import { WarehouseEfficiencyRow } from '../types';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Activity,
    Clock,
    Layers,
    AlertCircle,
    Truck,
    PackageCheck,
    CheckCircle2,
    Users,
} from 'lucide-react';

interface DetailDrawerProps {
    row: WarehouseEfficiencyRow | null;
    isOpen: boolean;
    onClose: () => void;
}

function formatToMMDDYYYY(isoDate?: string): string {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${month}-${day}-${year}`;
    }
    return isoDate;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
    row,
    isOpen,
    onClose,
}) => {
    if (!row) return null;

    const isBottleneckSevere = row.bottleneck === 'DOCK_CONGESTION' || row.bottleneck === 'PICKING_STALL';
    const spacePct = row.spaceUtilizationRate ?? 0;
    const dockPct = row.dockUtilizationRate ?? 0;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto p-6 space-y-6">
                {/* Header with Badges */}
                <SheetHeader className="pb-4 border-b space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs px-2.5 py-0.5">
                                {row.warehouseCode}
                            </Badge>
                            <Badge
                                variant="secondary"
                                className={`text-xs font-semibold px-2.5 py-0.5 ${
                                    row.bottleneck === 'SMOOTH_FLOW'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : isBottleneckSevere
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                            >
                                {row.bottleneck.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                            Window Snapshot: {formatToMMDDYYYY(row.date)}
                        </span>
                    </div>

                    <SheetTitle className="text-2xl font-bold tracking-tight text-foreground text-left">
                        {row.warehouseName}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground text-left">
                        Shift: <span className="font-semibold text-foreground">{row.shift}</span> &bull; Active batches evaluated: <span className="font-semibold text-foreground">{row.consolidatorCount}</span>
                    </SheetDescription>
                </SheetHeader>

                {/* Operational Finding Highlight */}
                <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                        isBottleneckSevere
                            ? 'bg-rose-50/60 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/60'
                            : 'bg-muted/40 border-border'
                    }`}
                >
                    <div
                        className={`p-2 rounded-lg shrink-0 ${
                            isBottleneckSevere
                                ? 'bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                        }`}
                    >
                        {isBottleneckSevere ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-0.5">
                            Operational Diagnosis & Bottleneck Analysis
                        </h4>
                        <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                            {row.bottleneckReason}
                        </p>
                    </div>
                </div>

                {/* 1. Productivity & Labor Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Activity className="h-4 w-4 text-blue-600" />
                        Picking & Packing Throughput
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg border bg-card shadow-2xs">
                            <span className="text-[11px] font-semibold text-muted-foreground block">
                                Pick Rate
                            </span>
                            <span className="text-xl font-bold text-foreground mt-0.5 block">
                                {row.pickRateDisplay}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Completed / Labor Hr</span>
                        </div>

                        <div className="p-3 rounded-lg border bg-card shadow-2xs">
                            <span className="text-[11px] font-semibold text-muted-foreground block">
                                Pack Rate
                            </span>
                            <span className="text-xl font-bold text-foreground mt-0.5 block">
                                {row.packRateDisplay}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Audited / Labor Hr</span>
                        </div>

                        <div className="p-3 rounded-lg border bg-card shadow-2xs">
                            <span className="text-[11px] font-semibold text-muted-foreground block">
                                Completed Volume
                            </span>
                            <span className="text-xl font-bold text-foreground mt-0.5 block">
                                {row.completedUnits.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {row.cylindersCount} cyls &bull; {row.palletsCount} pal
                            </span>
                        </div>

                        <div className="p-3 rounded-lg border bg-card shadow-2xs">
                            <span className="text-[11px] font-semibold text-muted-foreground block">
                                Productive Labor
                            </span>
                            <span className="text-xl font-bold text-foreground mt-0.5 block">
                                {row.productiveLaborHours !== null ? `${row.productiveLaborHours}h` : 'Unavailable'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {row.activePickersCount} active crew
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Dock Turnaround & Staging Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-600" />
                        Dock Bay Staging & Turnaround
                    </h3>

                    <div className="p-4 rounded-xl border bg-card space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                            <div>
                                <span className="font-semibold text-foreground">Dock Bay Utilization</span>
                                <p className="text-[11px] text-muted-foreground">
                                    {row.dockOccupiedHours} occupied hours vs. {row.dockAvailableHours} available hours
                                </p>
                            </div>
                            <span className="text-base font-bold text-foreground">
                                {row.dockUtilizationDisplay}
                            </span>
                        </div>

                        <Progress
                            value={dockPct}
                            className={`h-2 ${dockPct > 85 ? '[&>div]:bg-rose-500' : '[&>div]:bg-amber-500'}`}
                        />

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs">
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Average Queue Staging</span>
                                <span className="font-bold text-foreground text-sm">
                                    {row.averageQueueTimeMins !== null ? `${row.averageQueueTimeMins} mins` : 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Dispatch Plans Handled</span>
                                <span className="font-bold text-foreground text-sm">
                                    {row.dispatchPlanCount} plans
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Storage Footprint & Segregation Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-purple-600" />
                        Space Capacity & Fleet Footprint
                    </h3>

                    <div className="p-4 rounded-xl border bg-card space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                            <div>
                                <span className="font-semibold text-foreground">Storage Occupancy Rate</span>
                                <p className="text-[11px] text-muted-foreground">
                                    {row.occupiedCapacityUnits} occupied of {row.totalCapacityUnits} rated capacity units
                                </p>
                            </div>
                            <span className="text-base font-bold text-foreground">
                                {row.spaceUtilizationDisplay}
                            </span>
                        </div>

                        <Progress
                            value={spacePct}
                            className={`h-2 ${spacePct > 90 ? '[&>div]:bg-amber-600' : '[&>div]:bg-purple-600'}`}
                        />

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs">
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Segregated Quarantine / Scrap</span>
                                <span className="font-bold text-rose-600 text-sm">
                                    {row.damagedOrQuarantineAssets} cylinders
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Active Picking Batches</span>
                                <span className="font-bold text-foreground text-sm">
                                    {row.consolidatorCount} batch(es)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calculation Disclosures Footer */}
                <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1 border">
                    <div>
                        <strong>Calculation Rule:</strong> Productivity = completed comparable units / productive labor hours. If labor hours are zero, rate is marked Unavailable.
                    </div>
                    <div>
                        <strong>Human-in-the-Loop:</strong> Advisory analysis only. Operational changes require authorized supervisor approval.
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};
