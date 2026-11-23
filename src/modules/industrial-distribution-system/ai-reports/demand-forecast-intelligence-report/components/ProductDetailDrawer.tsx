/**
 * Product Detail Drawer Component - Slide-Over Sheet
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Product Details header (Description, Product ID, Branch)
 * - On-hand Stock Snapshot (Full, Empty, Total cylinders from v_serial_onhand)
 * - Demand Velocity Metrics (Ordered, Served, SO count, Avg order size)
 * - Replenishment Fulfillment Metrics (Purchased, Received, Coverage %)
 * - Monthly Demand Trend Breakdown table
 * - Unconditional hooks (Strict adherence to React Rules of Hooks)
 */

'use client';

import React from 'react';
import { ProductDemandRow } from '../types';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import {
    Package,
    TrendingUp,
    Layers,
    CheckCircle2,
    Calendar,
    Building2,
} from 'lucide-react';

interface ProductDetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    product: ProductDemandRow | null;
}

export const ProductDetailDrawer: React.FC<ProductDetailDrawerProps> = ({
    isOpen,
    onClose,
    product,
}) => {
    if (!product) return null;

    const covDisplay =
        product.replenishmentCoverage !== null
            ? `${product.replenishmentCoverage.toFixed(1)}%`
            : 'N/A';

    const unservedQty = Math.max(0, product.totalDemandQty - product.servedQty);
    const trendBuckets = product.monthlyDemandTrend || product.demandTrend || [];

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6 bg-background"
            >
                <SheetHeader className="pb-4 border-b border-border/80">
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-500" />
                        <SheetTitle className="text-lg font-bold text-foreground">
                            {product.productName}
                        </SheetTitle>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            ID #{product.productId}
                        </span>
                    </div>
                    <SheetDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>Branch: {product.branchName || 'All Branches'}</span>
                    </SheetDescription>
                </SheetHeader>

                {/* 1. Demand Forecasting & Inventory Runway */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        Multi-Horizon Demand Forecast &amp; Stock Runway
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Daily Burn Rate
                            </span>
                            <div className="text-base font-bold text-sky-600 dark:text-sky-400 mt-1">
                                {product.dailyBurnRate.toFixed(2)} /d
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                7-Day Forecast
                            </span>
                            <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {(product.forecast7Day ?? Math.round(product.dailyBurnRate * 7)).toLocaleString()} units
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                14-Day Forecast
                            </span>
                            <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                {(product.forecast14Day ?? Math.round(product.dailyBurnRate * 14)).toLocaleString()} units
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                30-Day Forecast
                            </span>
                            <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1">
                                {product.projected30DayDemand.toLocaleString()} units
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Est. Stockout Date
                            </span>
                            <div className="mt-1">
                                {product.stockOnHandFull === 0 ? (
                                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                                        Immediate (0d)
                                    </span>
                                ) : product.stockoutDaysRemaining !== null && product.stockoutDaysRemaining !== undefined ? (
                                    <span
                                        className={`text-sm font-bold ${
                                            product.stockoutDaysRemaining < 7
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : product.stockoutDaysRemaining < 15
                                                ? 'text-amber-600 dark:text-amber-400'
                                                : 'text-foreground'
                                        }`}
                                    >
                                        {product.estimatedStockoutDate
                                            ? new Date(product.estimatedStockoutDate + 'T00:00:00').toLocaleDateString(
                                                  'en-US',
                                                  { month: 'short', day: 'numeric' }
                                              )
                                            : ''}{' '}
                                        <span className="text-[11px] font-normal text-muted-foreground">
                                            ({product.stockoutDaysRemaining}d left)
                                        </span>
                                    </span>
                                ) : (
                                    <span className="text-sm font-medium text-muted-foreground">&gt;90 days</span>
                                )}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Reorder Needed
                            </span>
                            <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1">
                                {product.suggestedReplenishment > 0
                                    ? `+${product.suggestedReplenishment.toLocaleString()} units`
                                    : '0 units'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Next 14 Days Day-by-Day Forward Forecast & Stock Depletion Schedule */}
                {product.forwardDailySchedule && product.forwardDailySchedule.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-amber-500" />
                                Next 14 Days Forward Forecast Schedule
                            </h3>
                            <span className="text-[10px] text-muted-foreground">
                                {product.dailyBurnRate.toFixed(2)} units/day burn velocity
                            </span>
                        </div>

                        {product.stockoutDaysRemaining !== null && product.stockoutDaysRemaining < 14 && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                                <strong>Warning:</strong> Current usable stock ({product.stockOnHandFull} units) is projected to deplete completely on{' '}
                                <strong>
                                    {product.estimatedStockoutDate
                                        ? new Date(product.estimatedStockoutDate + 'T00:00:00').toLocaleDateString('en-US', {
                                              weekday: 'short',
                                              month: 'short',
                                              day: 'numeric',
                                          })
                                        : 'Day ' + product.stockoutDaysRemaining}
                                </strong>{' '}
                                unless replenishment arrives.
                            </div>
                        )}

                        <div className="rounded-xl border border-border overflow-hidden max-h-64 overflow-y-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted/40 border-b border-border text-[10px] uppercase font-bold text-muted-foreground sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2">Day</th>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2 text-right">Forecast Demand</th>
                                        <th className="px-3 py-2 text-right">Projected Stock</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {product.forwardDailySchedule.map((day) => {
                                        const isStockout = day.status === 'STOCKOUT';
                                        const isLow = day.status === 'LOW';

                                        return (
                                            <tr
                                                key={day.dayIndex}
                                                className={`transition-colors ${
                                                    isStockout
                                                        ? 'bg-rose-500/5 hover:bg-rose-500/10 font-semibold'
                                                        : isLow
                                                        ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                                        : 'hover:bg-muted/20'
                                                }`}
                                            >
                                                <td className="px-3 py-2 text-muted-foreground">Day +{day.dayIndex}</td>
                                                <td className="px-3 py-2 font-medium text-foreground">{day.dayLabel}</td>
                                                <td className="px-3 py-2 text-right font-medium text-sky-600 dark:text-sky-400">
                                                    +{day.projectedDemand}
                                                </td>
                                                <td
                                                    className={`px-3 py-2 text-right font-bold ${
                                                        isStockout
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : isLow
                                                            ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-emerald-600 dark:text-emerald-400'
                                                    }`}
                                                >
                                                    {day.endingStock}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {isStockout ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                            DEPLETED
                                                        </span>
                                                    ) : isLow ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            LOW STOCK
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                            SAFE
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. On-Hand Usable Inventory Snapshot */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-emerald-500" />
                        Usable Warehouse Inventory
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">
                                Full Cylinders (Usable Stock)
                            </span>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {product.stockOnHandFull.toLocaleString()}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Empty Cylinders (Return Containers)
                            </span>
                            <div className="text-xl font-bold text-muted-foreground mt-1">
                                {product.stockOnHandEmpty ? product.stockOnHandEmpty.toLocaleString() : '0'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Historical Demand Velocity */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-sky-500" />
                        Sales Demand &amp; Fulfillment
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Ordered Qty
                            </span>
                            <div className="text-lg font-bold text-sky-600 dark:text-sky-400 mt-1">
                                {product.totalDemandQty.toLocaleString()}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Served Qty
                            </span>
                            <div className="text-lg font-bold text-foreground mt-1">
                                {product.servedQty.toLocaleString()}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Unserved Qty
                            </span>
                            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {unservedQty.toLocaleString()}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Sales Orders
                            </span>
                            <div className="text-lg font-bold text-foreground mt-1">
                                {product.totalSoCount}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Replenishment Procurement Metrics */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        PO Replenishment &amp; Coverage
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                PO Ordered Qty
                            </span>
                            <div className="text-lg font-bold text-foreground mt-1">
                                {product.totalPurchasedQty.toLocaleString()}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                PO Received Qty
                            </span>
                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {product.totalReceivedQty.toLocaleString()}
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Coverage Ratio
                            </span>
                            <div
                                className={`text-lg font-bold mt-1 ${
                                    product.coverageStatus === 'BALANCED'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : product.coverageStatus === 'UNDERSUPPLIED'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-purple-600 dark:text-purple-400'
                                }`}
                            >
                                {covDisplay}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Monthly Demand Trend Breakdown */}
                {trendBuckets.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-purple-500" />
                            Monthly Demand Velocity Trend
                        </h3>
                        <div className="rounded-xl border border-border overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted/40 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">Month</th>
                                        <th className="px-3 py-2 text-right">Demand (Units)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {trendBuckets.map((b, idx) => (
                                        <tr key={idx} className="hover:bg-muted/20">
                                            <td className="px-3 py-2 font-medium text-foreground">{b.month}</td>
                                            <td className="px-3 py-2 text-right font-bold text-sky-600 dark:text-sky-400">
                                                {(b.orderedQty ?? b.demandQty ?? 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};
