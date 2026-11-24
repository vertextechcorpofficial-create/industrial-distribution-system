/**
 * Summary KPI Metric Cards for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements 4 vibrant theme-colored metric cards with rich glowing hover elevations:
 * - Stockout Risk Exposure: Rose theme
 * - Usable Available Fleet: Emerald theme
 * - Customer-Held Fleet & Utilization: Indigo theme
 * - Dead Stock Capital Drag: Amber theme
 */

'use client';

import React from 'react';
import { InventoryHealthExecutiveKPIs } from '../types';
import { ShieldAlert, CheckCircle2, Truck, AlertTriangle } from 'lucide-react';

interface SummaryCardsProps {
    kpis: InventoryHealthExecutiveKPIs | null;
    isLoading: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ kpis, isLoading }) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 bg-muted/40 animate-pulse rounded-2xl border border-border" />
                ))}
            </div>
        );
    }

    const criticalCount = kpis?.criticalStockoutSkusCount ?? 0;
    const elevatedCount = kpis?.elevatedRiskSkusCount ?? 0;
    const usableFleet = kpis?.totalUsableFleet ?? 0;
    const customerHeld = kpis?.totalCustomerHeld ?? 0;
    const utilRate = kpis?.fleetUtilizationRate;
    const tiedUpCapital = kpis?.totalTiedUpCapital ?? 0;
    const deadStockCount = kpis?.deadStockSkusCount ?? 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Critical Stockout Risk - Rose Theme */}
            <div className="group relative bg-card border border-rose-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-rose-500/10 hover:border-rose-500/50 hover:ring-1 hover:ring-rose-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Stockout Risk Exposure
                    </span>
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                        {criticalCount}
                    </span>
                    <span className="text-[11px] font-medium text-rose-600/80 dark:text-rose-400/80">
                        Critical SKU{criticalCount !== 1 ? 's' : ''}
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    {elevatedCount > 0 ? `+ ${elevatedCount} elevated risk SKU(s) (<14d)` : 'Coverage under 7 days or zero usable stock'}
                </p>
            </div>

            {/* 2. Usable Available Fleet - Emerald Theme */}
            <div className="group relative bg-card border border-emerald-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/50 hover:ring-1 hover:ring-emerald-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Usable Available Fleet
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {usableFleet.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                        Full Cylinders
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Good condition on-hand ready for dispatch
                </p>
            </div>

            {/* 3. Customer-Held Fleet & Utilization - Indigo Theme */}
            <div className="group relative bg-card border border-indigo-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/50 hover:ring-1 hover:ring-indigo-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Customer-Held Fleet
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        <Truck className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {customerHeld.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
                        {utilRate !== null && utilRate !== undefined ? `${utilRate}% Fleet Share` : 'Deployed'}
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Active cylinders in customer possession
                </p>
            </div>

            {/* 4. Dead Stock & Capital Drag - Amber Theme */}
            <div className="group relative bg-card border border-amber-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Dead Stock Capital Drag
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                        PHP {tiedUpCapital.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    {deadStockCount} dormant SKU{deadStockCount !== 1 ? 's' : ''} (&gt;90d zero consumption)
                </p>
            </div>
        </div>
    );
};
