/**
 * Detail Drawer Component for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Slide-over Sheet panel providing deep-dive operational inspection of a selected SKU
 * - Cylinder physical condition breakdown (Good, For Repair, Damaged, Scrap)
 * - Fleet custody breakdown (Usable On-Hand, Empty, Customer Held, In-Transit)
 * - Demand statistics and explicit safety stock calculation basis
 * - Working capital and dead stock valuation
 */

'use client';

import React from 'react';
import { SkuHealthRow } from '../types';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import {
    Package,
    Clock,
    Layers,
    DollarSign,
    Activity,
    Info,
} from 'lucide-react';

interface DetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    sku: SkuHealthRow | null;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
    isOpen,
    onClose,
    sku,
}) => {
    if (!sku) return null;

    const isCritical = sku.riskBand === 'CRITICAL';
    const isElevated = sku.riskBand === 'ELEVATED';

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col bg-background">
                {/* Header Banner */}
                <SheetHeader className="p-6 pb-4 border-b border-border/80 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Package className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <SheetTitle className="text-base font-bold text-foreground truncate">
                                {sku.productName}
                            </SheetTitle>
                            <SheetDescription className="text-xs text-muted-foreground truncate">
                                {sku.productCode} • {sku.category}
                            </SheetDescription>
                        </div>
                    </div>

                    {/* Risk & Aging Badges */}
                    <div className="flex items-center flex-wrap gap-2 pt-3">
                        <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                isCritical
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300'
                                    : isElevated
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                            }`}
                        >
                            Risk Band: {sku.riskBand}
                        </span>

                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                            Aging: {sku.agingCategory}
                        </span>

                        {sku.daysSinceLastMovement !== null && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                                <Clock className="h-3 w-3" />
                                {sku.daysSinceLastMovement} days since last activity
                            </span>
                        )}
                    </div>
                </SheetHeader>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 1. Fleet Custody Summary Cards */}
                    <div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-primary" />
                            Cylinder Fleet Custody & Status
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                <span className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase">
                                    Usable Full
                                </span>
                                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                    {sku.fleet.usableAvailableQuantity}
                                </span>
                                <span className="block text-[10px] text-muted-foreground">On-Hand Ready</span>
                            </div>

                            <div className="bg-muted/60 border border-border rounded-xl p-3 text-center">
                                <span className="block text-[10px] font-semibold text-muted-foreground uppercase">
                                    Empty
                                </span>
                                <span className="text-xl font-extrabold text-foreground">
                                    {sku.fleet.emptyQuantity}
                                </span>
                                <span className="block text-[10px] text-muted-foreground">At Branch</span>
                            </div>

                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-center">
                                <span className="block text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase">
                                    Customer Held
                                </span>
                                <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                                    {sku.fleet.customerHeldQuantity}
                                </span>
                                <span className="block text-[10px] text-muted-foreground">With Customers</span>
                            </div>

                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
                                <span className="block text-[10px] font-semibold text-rose-700 dark:text-rose-300 uppercase">
                                    Defective
                                </span>
                                <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                                    {sku.fleet.defectiveQuantity}
                                </span>
                                <span className="block text-[10px] text-muted-foreground">Repair / Scrap</span>
                            </div>
                        </div>

                        <div className="mt-2 text-right text-[11px] text-muted-foreground">
                            Total Registered Fleet: <strong className="text-foreground">{sku.fleet.totalFleetQuantity} cylinders</strong>
                        </div>
                    </div>

                    {/* 2. Physical Condition Breakdown */}
                    <div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-primary" />
                            Cylinder Asset Physical Conditions
                        </h3>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="border border-border/80 rounded-lg p-2 bg-card">
                                <span className="text-[10px] text-muted-foreground block">Good</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                    {sku.conditionBreakdown.good}
                                </span>
                            </div>
                            <div className="border border-border/80 rounded-lg p-2 bg-card">
                                <span className="text-[10px] text-muted-foreground block">For Repair</span>
                                <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                                    {sku.conditionBreakdown.forRepair}
                                </span>
                            </div>
                            <div className="border border-border/80 rounded-lg p-2 bg-card">
                                <span className="text-[10px] text-muted-foreground block">Damaged</span>
                                <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                                    {sku.conditionBreakdown.damaged}
                                </span>
                            </div>
                            <div className="border border-border/80 rounded-lg p-2 bg-card">
                                <span className="text-[10px] text-muted-foreground block">Scrap</span>
                                <span className="font-bold text-slate-500 text-sm">
                                    {sku.conditionBreakdown.scrap}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Demand & Replenishment Velocity */}
                    <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Info className="h-4 w-4 text-primary" />
                            Demand & Replenishment Parameters
                        </h3>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Evaluation Window</span>
                                <strong className="text-foreground">{sku.windowDays} Calendar Days</strong>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Verified Units Sold</span>
                                <strong className="text-foreground">{sku.totalDemand} cylinders</strong>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Average Daily Demand (ADS)</span>
                                <strong className="text-foreground">{sku.averageDailyDemand.toFixed(2)} units/day</strong>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Demand Std Deviation</span>
                                <strong className="text-foreground">{sku.demandStandardDeviation.toFixed(2)}</strong>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Coverage Days Remaining</span>
                                <strong className="text-foreground">
                                    {sku.coverageDays !== null ? `${sku.coverageDays} days` : 'Unavailable (Zero demand)'}
                                </strong>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Safety Stock Target</span>
                                <strong className="text-primary">{sku.safetyStockRecommendation} cylinders</strong>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                            <strong>Calculation Basis:</strong> {sku.safetyStockCalculationBasis}
                        </div>
                    </div>

                    {/* 4. Financial & Dead Stock Valuation */}
                    <div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5 text-primary" />
                            Working Capital & Dead Stock Valuation
                        </h3>
                        <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Unit Cost:</span>
                                <span className="font-semibold text-foreground">
                                    PHP {sku.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Selling Price per Unit:</span>
                                <span className="font-semibold text-foreground">
                                    PHP {sku.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Maintaining Threshold:</span>
                                <span className="font-semibold text-foreground">{sku.maintainingQuantity} cylinders</span>
                            </div>
                            <div className="pt-2 border-t border-border/60 flex justify-between items-baseline">
                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                    Tied-Up Capital in Dead Stock:
                                </span>
                                <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                                    PHP {sku.tiedUpCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
 
            </SheetContent>
        </Sheet>
    );
};
