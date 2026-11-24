/**
 * Executive Summary Cards Component for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Interactive hover states (shadow lift, border accent, smooth transition)
 * - Micro-interaction scale on icon badges
 * - Clear visual indicators for executive warehouse KPIs
 */

'use client';

import React from 'react';
import { WarehouseEfficiencyKPIs } from '../types';
import {
    Activity,
    Layers,
    Clock,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react';

interface SummaryCardsProps {
    kpis: WarehouseEfficiencyKPIs | null;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ kpis }) => {
    if (!kpis) return null;

    const pickRateDisplay = kpis.averagePickRate !== null ? `${kpis.averagePickRate} u/hr` : 'Unavailable';
    const dockDisplay = kpis.overallDockUtilizationRate !== null ? `${kpis.overallDockUtilizationRate}%` : 'Unavailable';
    const spaceDisplay = kpis.overallSpaceUtilizationRate !== null ? `${kpis.overallSpaceUtilizationRate}%` : 'Unavailable';
    const queueDisplay = kpis.averageQueueTimeMinutes !== null ? `${kpis.averageQueueTimeMinutes} mins` : 'Unavailable';

    const bottleneck = kpis.primaryIdentifiedBottleneck;
    const isBottleneckSevere = bottleneck === 'DOCK_CONGESTION' || bottleneck === 'PICKING_STALL';

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pick Throughput Card */}
                <div className="group bg-card border rounded-lg p-4 shadow-xs transition-all duration-200 ease-in-out hover:shadow-md hover:border-blue-400/50 hover:-translate-y-0.5 cursor-pointer flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Average Pick Rate
                        </p>
                        <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">
                            {pickRateDisplay}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {kpis.totalCompletedUnits.toLocaleString()} total units completed
                        </p>
                    </div>
                    <div className="p-2.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Activity className="h-5 w-5" />
                    </div>
                </div>

                {/* Dock Utilization Card */}
                <div className="group bg-card border rounded-lg p-4 shadow-xs transition-all duration-200 ease-in-out hover:shadow-md hover:border-amber-400/50 hover:-translate-y-0.5 cursor-pointer flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            Dock Bay Utilization
                        </p>
                        <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">
                            {dockDisplay}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across scheduled active staging bays
                        </p>
                    </div>
                    <div className="p-2.5 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <Clock className="h-5 w-5" />
                    </div>
                </div>

                {/* Space Occupancy Card */}
                <div className="group bg-card border rounded-lg p-4 shadow-xs transition-all duration-200 ease-in-out hover:shadow-md hover:border-purple-400/50 hover:-translate-y-0.5 cursor-pointer flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            Space Utilization
                        </p>
                        <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">
                            {spaceDisplay}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {kpis.totalCylindersPicked} cylinder units in circulation
                        </p>
                    </div>
                    <div className="p-2.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 group-hover:scale-110 transition-transform">
                        <Layers className="h-5 w-5" />
                    </div>
                </div>

                {/* Primary Constraint Card */}
                <div
                    className={`group bg-card border rounded-lg p-4 shadow-xs transition-all duration-200 ease-in-out hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex items-start justify-between ${
                        isBottleneckSevere ? 'hover:border-rose-400/50' : 'hover:border-emerald-400/50'
                    }`}
                >
                    <div>
                        <p
                            className={`text-xs font-semibold uppercase tracking-wide transition-colors ${
                                isBottleneckSevere
                                    ? 'text-rose-600/80 group-hover:text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600/80 group-hover:text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            Primary Bottleneck
                        </p>
                        <h3
                            className={`text-lg font-bold tracking-tight mt-1 ${
                                isBottleneckSevere ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            {bottleneck.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Avg staging queue: {queueDisplay}
                        </p>
                    </div>
                    <div
                        className={`p-2.5 rounded-md group-hover:scale-110 transition-transform ${
                            isBottleneckSevere
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                        }`}
                    >
                        {isBottleneckSevere ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                </div>
            </div>

            {/* Reporting Metadata Notice */}
            <div className="bg-muted/40 border rounded px-3 py-2 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
                <div>
                    <span className="font-semibold text-foreground">Calculation Basis:</span> {kpis.metadata.calculationBasis}
                </div>
                <div>
                    <span className="font-semibold text-foreground">Cutoff:</span> {kpis.metadata.sourceCutoff}
                </div>
            </div>
        </div>
    );
};
