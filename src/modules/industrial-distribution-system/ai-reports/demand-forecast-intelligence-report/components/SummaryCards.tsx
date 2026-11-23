/**
 * Summary KPI Metric Cards for Demand Forecast Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - 6 Executive KPI Metric Cards with vibrant theme accents and hover elevation
 * - Evaluated Products (Blue theme)
 * - Total Demand Qty (Sky theme)
 * - Total Stock On-Hand (Teal theme - live snapshot from v_serial_onhand)
 * - Avg Replenishment Coverage (Emerald theme)
 * - Undersupplied Products (Rose theme - coverage < 80%)
 * - Oversupplied Products (Purple theme - coverage > 150%)
 * - Unconditional hooks (pure presentational component)
 */

'use client';

import React from 'react';
import { DemandForecastKPIs } from '../types';
import { Package, TrendingUp, Layers, ArrowUpRight, AlertTriangle, ShoppingCart } from 'lucide-react';

interface SummaryCardsProps {
    kpis: DemandForecastKPIs | null;
    isLoading: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ kpis, isLoading }) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-28 bg-muted/40 animate-pulse rounded-2xl border border-border" />
                ))}
            </div>
        );
    }

    const totalProducts = kpis?.totalProductsEvaluated ?? 0;
    const totalDemand = kpis?.totalDemandQty ?? 0;
    const totalFullStock = kpis?.totalStockOnHand ?? 0;
    const projectedForecast = kpis?.projectedTotalForecast30Day ?? 0;
    const criticalStockouts = kpis?.criticalStockoutCount ?? 0;
    const suggestedReorder = kpis?.recommendedReplenishmentTotal ?? 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 1. Evaluated Products - Blue Theme */}
            <div className="group relative bg-card border border-blue-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/50 hover:ring-1 hover:ring-blue-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Evaluated SKUs
                    </span>
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Package className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {totalProducts}
                    </span>
                    <span className="text-[11px] font-medium text-blue-600/80 dark:text-blue-400/80">
                        SKUs
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Division 1 parent items</p>
            </div>

            {/* 2. Total Demand Qty - Sky Theme */}
            <div className="group relative bg-card border border-sky-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-500/10 hover:border-sky-500/50 hover:ring-1 hover:ring-sky-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Period Demand
                    </span>
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                        <TrendingUp className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {totalDemand.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-medium text-sky-600/80 dark:text-sky-400/80">
                        Units
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">From active sales orders</p>
            </div>

            {/* 3. Full Stock On-Hand - Teal Theme (Usable inventory only) */}
            <div className="group relative bg-card border border-teal-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-500/10 hover:border-teal-500/50 hover:ring-1 hover:ring-teal-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Full Stock On-Hand
                    </span>
                    <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
                        <Layers className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {totalFullStock.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-medium text-teal-600/80 dark:text-teal-400/80">
                        Usable Full
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Available full cylinders only</p>
            </div>

            {/* 4. 30-Day Projected Demand Forecast - Indigo Theme */}
            <div className="group relative bg-card border border-indigo-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/50 hover:ring-1 hover:ring-indigo-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        30-Day Forecast
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        <ArrowUpRight className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                        {projectedForecast.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
                        Units / Mo
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    7-Day: <strong className="text-foreground">{kpis?.projected7DayDemandTotal ? kpis.projected7DayDemandTotal.toLocaleString() : 0}</strong> units
                </p>
            </div>

            {/* 5. Critical Stockouts - Rose Theme */}
            <div className="group relative bg-card border border-rose-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-rose-500/10 hover:border-rose-500/50 hover:ring-1 hover:ring-rose-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Critical Stockouts
                    </span>
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                        {criticalStockouts}
                    </span>
                    <span className="text-[11px] font-medium text-rose-600/80 dark:text-rose-400/80">
                        SKUs At Risk
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Runway &lt; 7 days supply</p>
            </div>

            {/* 6. Suggested Replenishment - Amber Theme */}
            <div className="group relative bg-card border border-amber-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Suggested Reorder
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <ShoppingCart className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                        {suggestedReorder.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-medium text-amber-600/80 dark:text-amber-400/80">
                        Units Needed
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">To maintain safe 30d buffer</p>
            </div>
        </div>
    );
};
