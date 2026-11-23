/**
 * Visual Graphics Component for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements 2 Visual Graphics:
 * 1. Cylinder Fleet Composition (Stacked Bar Chart: Usable Full vs Empty vs Customer-Held vs Defective)
 * 2. Inventory Risk Portfolio Distribution (Donut Chart: Critical, Elevated, Moderate, Healthy, Excess, No Demand)
 *
 * Label contract: category names reach the chart in full and are wrapped, never rotated or
 * pre-truncated, so no label is clipped by the plot edge and the hover title carries the whole name.
 */

'use client';

import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
    CartesianGrid,
    type TooltipProps,
} from 'recharts';
import { BarChart3, PieChart as PieIcon } from 'lucide-react';
import { SkuHealthRow } from '../types';

interface InventoryRiskChartsProps {
    skus: SkuHealthRow[];
    isLoading?: boolean;
}

/**
 * Custom High-Contrast Theme-Aware Tooltip for Bar Chart
 */
function CustomBarTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="rounded-xl border border-border/80 bg-background/95 dark:bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md text-foreground text-xs space-y-2 min-w-[200px] z-50">
            {label && (
                <div className="font-bold text-foreground pb-1.5 border-b border-border/60 text-[12px] truncate max-w-[240px]">
                    {label}
                </div>
            )}
            <div className="space-y-1.5 pt-0.5">
                {payload.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                            <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: item.color || item.fill }}
                            />
                            <span>{item.name}:</span>
                        </span>
                        <span className="font-bold text-foreground text-[11px] tabular-nums">
                            {Number(item.value ?? 0).toLocaleString()} cylinders
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Custom Tooltip for Risk Distribution Donut Chart
 */
function CustomPieTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0];

    return (
        <div className="rounded-xl border border-border/80 bg-background/95 dark:bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md text-foreground text-xs space-y-1 z-50">
            <div className="font-bold text-foreground pb-1 border-b border-border/60 text-[12px] flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: data.payload?.color }} />
                <span>{data.name}</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-muted-foreground text-[11px]">SKU Count:</span>
                <span className="font-bold text-foreground text-[11px] tabular-nums">{data.value} SKUs</span>
            </div>
            {data.payload?.percentage !== undefined && (
                <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground text-[11px]">Share:</span>
                    <span className="font-bold text-foreground text-[11px] tabular-nums">{data.payload.percentage}%</span>
                </div>
            )}
        </div>
    );
}

const RISK_COLORS: Record<string, string> = {
    'Critical (<7d)': '#f43f5e',
    'Elevated (7-14d)': '#f97316',
    'Moderate (15-30d)': '#eab308',
    'Healthy (31-90d)': '#10b981',
    'Excess (>90d)': '#8b5cf6',
    'No Demand': '#64748b',
};

/**
 * Wrapped x-axis tick for the fleet composition chart.
 * WHY: SKU labels are full product descriptions ("LPG 11kg Cylinder Refill..."), and eight of
 * them share this card. Rotating them (angle=-15) needed more vertical space than the chart
 * reserved, so they were clipped at the bottom edge. Wrapping onto a few short lines keeps every
 * label inside the plot area, and the native <title> still exposes the untruncated name on hover.
 * Width is tighter than the logistics report's 18 characters because eight labels sit side by side.
 */
const TICK_WRAP_CHARS = 14; // max characters per line before wrapping
const TICK_MAX_LINES = 3;   // beyond this the last line is ellipsised

function wrapLabel(text: string): string[] {
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(/\s+/)) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= TICK_WRAP_CHARS || !current) {
            current = next; // fits, or a single word longer than the limit (handled below)
        } else {
            lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);

    // Clamp line count and hard-truncate any over-long line with an ellipsis.
    const clamped = lines.slice(0, TICK_MAX_LINES);
    if (lines.length > TICK_MAX_LINES) clamped[TICK_MAX_LINES - 1] += '…';
    return clamped.map((l) => (l.length > TICK_WRAP_CHARS + 2 ? `${l.slice(0, TICK_WRAP_CHARS)}…` : l));
}

/** Recharts clones the tick element with the position and the category value it wants drawn. */
interface WrappedTickProps {
    x?: number | string;
    y?: number | string;
    payload?: { value?: string | number };
}

function WrappedTick({ x = 0, y = 0, payload }: WrappedTickProps) {
    const full = String(payload?.value ?? '');
    return (
        <g transform={`translate(${x},${y})`}>
            <text textAnchor="middle" fill="currentColor" fontSize={10} className="text-muted-foreground">
                {/* Native hover tooltip so a truncated label can still be read in full. */}
                <title>{full}</title>
                {wrapLabel(full).map((line, i) => (
                    <tspan key={i} x={0} dy={12}>
                        {line}
                    </tspan>
                ))}
            </text>
        </g>
    );
}

export const InventoryRiskCharts: React.FC<InventoryRiskChartsProps> = ({
    skus,
    isLoading = false,
}) => {
    // 1. Top 8 SKUs by Total Fleet Size for the Stacked Bar Chart
    const barChartData = useMemo(() => {
        return [...skus]
            .sort((a, b) => b.fleet.totalFleetQuantity - a.fleet.totalFleetQuantity)
            .slice(0, 8)
            .map((s) => ({
                // Full label goes to the chart; WrappedTick decides where it breaks and whether
                // to ellipsise. Truncating here would ellipsise before wrapping and lose the name
                // from the hover title and the tooltip header too.
                name: s.productName,
                code: s.productCode,
                usable: s.fleet.usableAvailableQuantity,
                empty: s.fleet.emptyQuantity,
                customerHeld: s.fleet.customerHeldQuantity,
                defective: s.fleet.defectiveQuantity,
            }));
    }, [skus]);

    // 2. Risk Band Distribution for Donut Chart
    const pieChartData = useMemo(() => {
        const counts: Record<string, number> = {
            'Critical (<7d)': 0,
            'Elevated (7-14d)': 0,
            'Moderate (15-30d)': 0,
            'Healthy (31-90d)': 0,
            'Excess (>90d)': 0,
            'No Demand': 0,
        };

        skus.forEach((s) => {
            if (s.riskBand === 'CRITICAL') counts['Critical (<7d)']++;
            else if (s.riskBand === 'ELEVATED') counts['Elevated (7-14d)']++;
            else if (s.riskBand === 'MODERATE') counts['Moderate (15-30d)']++;
            else if (s.riskBand === 'HEALTHY') counts['Healthy (31-90d)']++;
            else if (s.riskBand === 'EXCESS') counts['Excess (>90d)']++;
            else if (s.riskBand === 'NO_DEMAND') counts['No Demand']++;
        });

        const total = skus.length || 1;
        return Object.entries(counts)
            .map(([name, count]) => ({
                name,
                value: count,
                color: RISK_COLORS[name],
                percentage: Number(((count / total) * 100).toFixed(1)),
            }))
            .filter((item) => item.value > 0);
    }, [skus]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 h-72 bg-muted/40 animate-pulse rounded-2xl border border-border" />
                <div className="h-72 bg-muted/40 animate-pulse rounded-2xl border border-border" />
            </div>
        );
    }

    if (skus.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart 1: Cylinder Fleet Composition (Stacked Bar) */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <BarChart3 className="h-4 w-4" />
                            </div>
                            <h2 className="text-sm font-bold text-foreground">
                                Cylinder Fleet Breakdown (Top 8 SKUs)
                            </h2>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">
                            Usable vs Empty vs Customer-Held vs Defective
                        </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3">
                        Visualizes asset distribution and decanting bottlenecks across high-volume parent gases.
                    </p>
                </div>

                <div className="h-64 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                            {/* Wrapped tick replaces the rotated label; height reserves space for 3 lines. */}
                            <XAxis
                                dataKey="name"
                                tick={<WrappedTick />}
                                tickLine={false}
                                axisLine={{ opacity: 0.2 }}
                                interval={0}
                                height={48}
                            />
                            <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} />
                            <Tooltip content={<CustomBarTooltip />} />
                            <Legend
                                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                formatter={(value) => <span className="text-foreground">{value}</span>}
                            />
                            <Bar dataKey="usable" name="Usable Full" fill="#10b981" stackId="fleet" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="empty" name="Empty" fill="#94a3b8" stackId="fleet" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="customerHeld" name="With Customer" fill="#6366f1" stackId="fleet" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="defective" name="Defective" fill="#f43f5e" stackId="fleet" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 2: Inventory Risk Portfolio (Donut) */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                <PieIcon className="h-4 w-4" />
                            </div>
                            <h2 className="text-sm font-bold text-foreground">
                                Stockout Risk Portfolio
                            </h2>
                        </div>
                        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                            {skus.length} SKUs
                        </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                        Categorization based on days of coverage remaining.
                    </p>
                </div>

                <div className="h-44 w-full relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<CustomPieTooltip />} />
                            <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={42}
                                outerRadius={68}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Donut Center Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xs text-muted-foreground font-semibold">Total</span>
                        <span className="text-base font-extrabold text-foreground">{skus.length}</span>
                    </div>
                </div>

                {/* Micro Legend */}
                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/50 text-[10px]">
                    {pieChartData.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="min-w-0 break-words text-muted-foreground">{d.name}:</span>
                            <span className="font-bold text-foreground tabular-nums ml-auto">{d.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
