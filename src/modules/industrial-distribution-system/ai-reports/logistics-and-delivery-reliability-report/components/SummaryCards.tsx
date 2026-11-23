/**
 * Executive KPI cards — Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Six cards: punctuality headline, arrival gap, trip coverage, lateness split, delivery shortfall, cost per unit.
 * - Every rate states the base it was divided by, because the punctuality share deliberately excludes
 *   trips that never carried an arrival promise.
 */

'use client';

import React from 'react';
import { ReportExecutiveKPIs } from '../types';
import {
    formatDurationMinutes,
    formatPeso,
    formatPercent,
    formatSignedDuration as signedGap,
    plural,
} from '../services/logisticsMetrics';
import {
    Target,
    Timer,
    Truck,
    AlertTriangle,
    PackageX,
    Receipt,
} from 'lucide-react';

interface SummaryCardsProps {
    kpis: ReportExecutiveKPIs | null;
    isLoading: boolean;
}

const CARD =
    'group relative bg-card border rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden';

export const SummaryCards: React.FC<SummaryCardsProps> = ({ kpis, isLoading }) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-28 bg-muted/40 animate-pulse rounded-2xl border border-border" />
                ))}
            </div>
        );
    }

    const measurable = kpis?.measurableTripsCount ?? 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Headline punctuality */}
            <div className={`${CARD} border-emerald-500/20 hover:shadow-emerald-500/10 hover:border-emerald-500/50 hover:ring-1 hover:ring-emerald-500/30`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Arrived On Time
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                        <Target className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {formatPercent(kpis?.onTimeSharePercentage)}
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                        of {plural(measurable, 'committed trip')}
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Arrival within ±{kpis?.toleranceMinutes ?? 0} min of the promised time.
                </p>
            </div>

            {/* 2. Arrival gap */}
            <div className={`${CARD} border-blue-500/20 hover:shadow-blue-500/10 hover:border-blue-500/50 hover:ring-1 hover:ring-blue-500/30`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Average Arrival Gap
                    </span>
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Timer className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {formatDurationMinutes(kpis?.meanAbsoluteErrorMinutes ?? null)}
                    </span>
                    <span className="text-[11px] font-medium text-blue-600/80 dark:text-blue-400/80">
                        early or late
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Median {signedGap(kpis?.medianEtaErrorMinutes ?? null)} (− = closed before the promise).
                </p>
            </div>

            {/* 3. Trip coverage - Indigo/Cyan Theme */}
            <div className={`${CARD} border-indigo-500/20 hover:shadow-indigo-500/10 hover:border-indigo-500/50 hover:ring-1 hover:ring-indigo-500/30`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Posted Trips
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        <Truck className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {kpis?.totalTripsEvaluated ?? 0}
                    </span>
                    <span className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
                        in period
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    {measurable} promised an arrival · {kpis?.uncommittedTripsCount ?? 0} did not ·{' '}
                    {kpis?.missingArrivalCount ?? 0} never closed
                </p>
            </div>

            {/* 4. Lateness split */}
            <div className={`${CARD} border-rose-500/20 hover:shadow-rose-500/10 hover:border-rose-500/50 hover:ring-1 hover:ring-rose-500/30`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Late Arrivals
                    </span>
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                        {kpis?.lateTripsCount ?? 0}
                    </span>
                    <span className="text-[11px] font-medium text-rose-600/80 dark:text-rose-400/80">
                        {kpis?.earlyTripsCount ?? 0} arrived early
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    {kpis?.depotLateDeparturesCount ?? 0} left the branch late · {kpis?.roadLateArrivalsCount ?? 0}
                    {' '}lost time on the road
                </p>
            </div>

            {/* 5. Delivery shortfall */}
            <div className={`${CARD} border-amber-500/20 hover:shadow-amber-500/10 hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/30`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Stops Unfulfilled
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <PackageX className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {kpis?.unfulfilledStopsCount ?? 0}
                    </span>
                    <span className="text-[11px] font-medium text-amber-600/80 dark:text-amber-400/80">
                        of {plural(kpis?.totalStops ?? 0, 'stop')}
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    {formatPercent(kpis?.unfulfilledStopsPercentage)} shortfall ·{' '}
                    {kpis?.returnsStopsCount ?? 0} came back with returns
                </p>
            </div>

            {/* 6. Cost per unit */}
            <div
                className={`${CARD} border-purple-500/20 hover:shadow-purple-500/10 hover:border-purple-500/50 hover:ring-1 hover:ring-purple-500/30`}
                title="Delivery Cost / Unit = Total Approved Trip Budget (post_dispatch_budgeting) divided by Total Serialized Units Delivered"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-fuchsia-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Delivery Cost / Unit
                    </span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                        <Receipt className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {formatPeso(kpis?.averageCostPerDeliveredUnit)}
                    </span>
                    <span className="text-[11px] font-medium text-purple-600/80 dark:text-purple-400/80">
                        per item delivered
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    {formatPeso(kpis?.totalTripCost)} trip budgets ÷ {plural(kpis?.totalDeliveredUnits ?? 0, 'serialized unit')}
                </p>
            </div>
        </div>
    );
};
