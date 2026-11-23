/**
 * Visual Graphics Component for Demand Forecast Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements 2 Visual Graphics matching Metric Card UI/elevation:
 * 1. Top Products Demand vs. Replenishment & Stock (Bar Chart: Demand Qty vs Received vs Stock On-Hand)
 * 2. Replenishment Coverage Portfolio Distribution (Donut Chart: Undersupplied / Balanced / Oversupplied breakdown)
 *
 * Visual Theme:
 * - Sky (#0284c7) for Demand Qty
 * - Emerald (#10b981) for Received / Balanced
 * - Teal (#14b8a6) for Stock On-Hand
 * - Rose (#f43f5e) for Undersupplied (<80%)
 * - Purple (#a855f7) for Oversupplied (>150%)
 * - Light and Dark theme high-contrast support
 * - Unconditional hooks at top of component (Strict adherence to React Rules of Hooks)
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    AreaChart,
    Area,
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
import { BarChart3, PieChart as PieIcon, Calendar, TrendingUp } from 'lucide-react';
import { ProductDemandRow, DemandForecastKPIs } from '../types';

interface DemandChartsProps {
    products: ProductDemandRow[];
    kpis?: DemandForecastKPIs | null;
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
                            {Number(item.value ?? 0).toLocaleString()} units
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Custom Tooltip for Coverage Donut Chart
 */
function CustomPieTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];

    return (
        <div className="rounded-xl border border-border/80 bg-background/95 dark:bg-zinc-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-md text-foreground text-xs space-y-1.5 min-w-[140px] z-50">
            <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.payload?.fill || '#6366f1' }}
                />
                <span className="font-bold text-foreground text-[12px]">{item.name}</span>
            </div>
            <div className="text-muted-foreground text-[11px] flex justify-between gap-4 font-medium">
                <span>Products:</span>
                <span className="font-bold text-foreground tabular-nums">{item.value}</span>
            </div>
        </div>
    );
}

/**
 * Wrapped x-axis tick, shared by every category axis in this report.
 * WHY: product names such as "LPG Cylinder 13KG (Empty)" are long. Rotating them (angle=-25)
 * needed more vertical space than the chart reserved, so they were clipped at the bottom edge,
 * and pre-truncating them to 16 characters made two similar SKUs read as the same label.
 * Wrapping onto a few short lines keeps every label inside the plot area and still legible.
 * The line width is 14 characters (not the 18 used by the full-width logistics route chart)
 * because this panel is 2/3 of the grid and carries 8 categories, so each band is only ~85px.
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

export const DemandCharts: React.FC<DemandChartsProps> = ({
    products,
    isLoading = false,
}) => {
    // Unconditional state hook: toggle between Top Products Forecast Bar vs Next 14-Day Trajectory Area
    const [viewMode, setViewMode] = useState<'bars' | 'forward'>('bars');

    // 1. Data for Bar Chart: Top 8 Products by 30D Forecast & Full Stock (unconditional hook)
    const topDemandData = useMemo(() => {
        const top = [...products]
            .sort((a, b) => b.projected30DayDemand - a.projected30DayDemand)
            .slice(0, 8);
        // Rows are per product *branch*, so one All-branches view can put the same product name on
        // the axis twice. A repeated name is qualified with its branch instead of plotting two
        // bars that look like the same SKU.
        const nameCount = new Map<string, number>();
        for (const p of top) nameCount.set(p.productName, (nameCount.get(p.productName) ?? 0) + 1);
        return top.map((p) => {
            const duplicated = (nameCount.get(p.productName) ?? 0) > 1;
            const label =
                duplicated && p.branchName ? `${p.productName} (${p.branchName})` : p.productName;
            return {
                name: label,
                'Full Stock': p.stockOnHandFull,
                '7D Forecast': p.forecast7Day,
                '30D Forecast': p.projected30DayDemand,
            };
        });
    }, [products]);

    // 2. Data for Forward 14-Day Depletion Trajectory (unconditional hook)
    const forwardTrajectoryData = useMemo(() => {
        const totalFullStock = products.reduce((acc, p) => acc + p.stockOnHandFull, 0);
        const totalDailyBurn = products.reduce((acc, p) => acc + p.dailyBurnRate, 0);
        const today = new Date();

        const points = [];
        points.push({
            name: 'Today',
            dayLabel: 'Today',
            'Cumulative Demand': 0,
            'Projected Full Stock': totalFullStock,
        });

        for (let d = 1; d <= 14; d++) {
            const nextD = new Date(today);
            nextD.setDate(today.getDate() + d);
            const dayLabel = nextD.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            });
            const cumDemand = Math.round(totalDailyBurn * d);
            const projStock = Math.max(0, Math.round(totalFullStock - totalDailyBurn * d));

            points.push({
                name: `Day +${d}`,
                dayLabel,
                'Cumulative Demand': cumDemand,
                'Projected Full Stock': projStock,
            });
        }
        return points;
    }, [products]);

    // 3. Data for Runway Health Donut Chart (unconditional hook)
    const runwayDistributionData = useMemo(() => {
        let critical = 0;
        let low = 0;
        let balanced = 0;
        let surplus = 0;
        let noDemand = 0;

        products.forEach((p) => {
            if (p.runwayStatus === 'CRITICAL_STOCKOUT') critical++;
            else if (p.runwayStatus === 'LOW_RUNWAY') low++;
            else if (p.runwayStatus === 'BALANCED') balanced++;
            else if (p.runwayStatus === 'SURPLUS') surplus++;
            else noDemand++;
        });

        return [
            { name: 'Critical (<7d)', value: critical, fill: '#f43f5e' },
            { name: 'Low Runway (7-14d)', value: low, fill: '#f59e0b' },
            { name: 'Balanced (15-45d)', value: balanced, fill: '#10b981' },
            { name: 'Surplus (>45d)', value: surplus, fill: '#6366f1' },
            ...(noDemand > 0 ? [{ name: 'No Demand', value: noDemand, fill: '#94a3b8' }] : []),
        ].filter((item) => item.value > 0);
    }, [products]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 h-72 bg-muted/40 animate-pulse rounded-2xl border border-border" />
                <div className="h-72 bg-muted/40 animate-pulse rounded-2xl border border-border" />
            </div>
        );
    }

    if (products.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart 1: Forward Forecast Trajectory / Top Products Comparison */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-border/60 gap-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            {viewMode === 'bars' ? (
                                <BarChart3 className="h-4 w-4" />
                            ) : (
                                <TrendingUp className="h-4 w-4" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">
                                {viewMode === 'bars'
                                    ? 'Top Products: 7D & 30D Forecast vs. Full Stock'
                                    : 'Next 14 Days Demand & Stock Depletion Trajectory'}
                            </h3>
                            <p className="text-[11px] text-muted-foreground">
                                {viewMode === 'bars'
                                    ? 'Compares available usable stock against projected demand over 7-day and 30-day horizons'
                                    : 'Simulates daily portfolio demand accumulation and full cylinder depletion over the next 14 days'}
                            </p>
                        </div>
                    </div>

                    {/* View Mode Toggle Pill */}
                    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => setViewMode('bars')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors font-medium ${
                                viewMode === 'bars'
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <BarChart3 className="h-3 w-3" />
                            <span>Top SKUs</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('forward')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors font-medium ${
                                viewMode === 'forward'
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Calendar className="h-3 w-3" />
                            <span>14-Day Trajectory</span>
                        </button>
                    </div>
                </div>

                <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        {viewMode === 'bars' ? (
                            <BarChart
                                data={topDemandData}
                                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                                {/* Custom wrapped tick replaces the rotated, pre-truncated label; height reserves space for 3 lines. */}
                                <XAxis
                                    dataKey="name"
                                    tick={<WrappedTick />}
                                    tickLine={false}
                                    interval={0}
                                    height={52}
                                    stroke="#94a3b8"
                                    opacity={0.8}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'currentColor' }}
                                    stroke="#94a3b8"
                                    opacity={0.8}
                                />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Legend
                                    verticalAlign="top"
                                    align="right"
                                    iconType="circle"
                                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                                />
                                <Bar dataKey="Full Stock" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="7D Forecast" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="30D Forecast" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        ) : (
                            <AreaChart
                                data={forwardTrajectoryData}
                                margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                            >
                                <defs>
                                    <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                                {/* Same tick component, so toggling views never shifts the label style. */}
                                <XAxis
                                    dataKey="name"
                                    tick={<WrappedTick />}
                                    tickLine={false}
                                    stroke="#94a3b8"
                                    opacity={0.8}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'currentColor' }}
                                    stroke="#94a3b8"
                                    opacity={0.8}
                                />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Legend
                                    verticalAlign="top"
                                    align="right"
                                    iconType="circle"
                                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Projected Full Stock"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorStock)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Cumulative Demand"
                                    stroke="#0284c7"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorDemand)"
                                />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 2: Inventory Runway Risk Donut */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs transition-all duration-300 hover:shadow-md space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <PieIcon className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Stock Runway Health</h3>
                            <p className="text-[11px] text-muted-foreground">
                                Product breakdown by days-of-supply runway risk
                            </p>
                        </div>
                    </div>
                </div>

                <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={runwayDistributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={85}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {runwayDistributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomPieTooltip />} />
                            <Legend
                                verticalAlign="bottom"
                                align="center"
                                iconType="circle"
                                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
