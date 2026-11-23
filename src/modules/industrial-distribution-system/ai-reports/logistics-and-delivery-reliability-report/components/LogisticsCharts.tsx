/**
 * Visual analytics — Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements 3 panels matching the metric-card elevation language:
 * 1. Arrival gap distribution — how far the recorded arrivals landed from the promised time.
 * 2. Route reliability comparison — on-time share per branch→cluster lane.
 * 3. Evidence coverage — how much of the corpus actually carries proofs, GPS, fuel and distance.
 *
 * Visual theme: emerald for on-time, amber for near-miss, rose for late, blue for early.
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
    CartesianGrid,
    Cell,
    type TooltipProps,
} from 'recharts';
import { BarChart3, Route, ShieldQuestion } from 'lucide-react';
import { EtaBucketRow, ReportExecutiveKPIs, RoutePerformanceRow, TripSummaryRow } from '../types';
import { ARRIVAL_STATE_LABELS, EVIDENCE_OUT_OF_SCOPE_NOTE } from '../services/logisticsMetrics';

interface LogisticsChartsProps {
    kpis: ReportExecutiveKPIs | null;
    routes: RoutePerformanceRow[];
    trips: TripSummaryRow[];
}

const BUCKET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#fb7185', '#f43f5e', '#be123c'];

/** Count tooltip: the y-axis here is trips, so no percent sign. */
function CustomTripCountTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="rounded-xl border border-border/80 bg-background/95 dark:bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md text-foreground text-xs min-w-[170px] z-50">
            {label && (
                <div className="font-bold text-foreground pb-1.5 border-b border-border/60 text-[12px]">
                    {label}
                </div>
            )}
            {payload.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 pt-1.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                        <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color || item.payload?.fill || '#6366f1' }}
                        />
                        {item.name}:
                    </span>
                    <span className="font-bold text-foreground text-[11px] tabular-nums">
                        {Number(item.value ?? 0)} trip{Number(item.value ?? 0) === 1 ? '' : 's'}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Percentage tooltip used by the route comparison chart. */
function CustomRateTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0]?.payload as (RoutePerformanceRow & { scoreTone: string }) | undefined;
    return (
        <div className="rounded-xl border border-border/80 bg-background/95 dark:bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md text-foreground text-xs min-w-[220px] z-50">
            <div className="font-bold text-foreground pb-1.5 border-b border-border/60 text-[12px]">{label}</div>
            <div className="space-y-1 pt-1.5 text-[11px]">
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Arrived on time:</span>
                    <span className="font-bold tabular-nums">{Number(payload[0]?.value ?? 0)}%</span>
                </div>
                {row && (
                    <>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Scored trips:</span>
                            <span className="font-bold tabular-nums">
                                {row.measurableTrips} of {row.totalTrips}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Late:</span>
                            <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">
                                {row.lateTrips}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const PANEL =
    'group relative bg-card border rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden flex flex-col';
/**
 * Wrapped x-axis tick for the route chart.
 * WHY: lane names such as "Central Pangasinan / Eastern Pangasinan" are long. Rotating them
 * (angle=-15) needed more vertical space than the chart reserved, so they were clipped at the
 * bottom edge. Wrapping onto a few short lines keeps every label inside the plot area.
 */
const TICK_WRAP_CHARS = 18; // max characters per line before wrapping
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
export const LogisticsCharts: React.FC<LogisticsChartsProps> = ({ kpis, routes, trips }) => {
    const bucketData = useMemo<EtaBucketRow[]>(() => kpis?.etaBuckets ?? [], [kpis]);

    // Top 7 lanes by volume; a lane with no arrival promise plots at 0 but is excluded from the axis label noise.
    const routeData = useMemo(() => {
        const top = [...routes]
            .filter((r) => r.measurableTrips > 0)
            .sort((a, b) => b.totalTrips - a.totalTrips)
            .slice(0, 7);
        // Two branches can serve the same cluster — and unlinked trips all collapse onto one placeholder —
        // so a repeated cluster name is qualified with its branch instead of plotting two identical bars.
        const clusterCount = new Map<string, number>();
        for (const r of top) clusterCount.set(r.destinationCluster, (clusterCount.get(r.destinationCluster) ?? 0) + 1);
        return top.map((r) => ({
            ...r,
            label:
                (clusterCount.get(r.destinationCluster) ?? 0) > 1
                    ? `${r.destinationCluster} (${r.depotBranchName})`
                    : r.destinationCluster,
            onTime: r.onTimeRatePercentage ?? 0,
            scoreTone:
                (r.onTimeRatePercentage ?? 0) >= 85
                    ? '#10b981'
                    : (r.onTimeRatePercentage ?? 0) >= 60
                        ? '#f59e0b'
                        : '#f43f5e',
        }));
    }, [routes]);

    const verdictData = useMemo(() => {
        const map = new Map<string, number>();
        for (const trip of trips) {
            const label = ARRIVAL_STATE_LABELS[trip.arrivalState];
            map.set(label, (map.get(label) ?? 0) + 1);
        }
        const colorFor: Record<string, string> = {
            [ARRIVAL_STATE_LABELS.ON_TIME]: '#10b981',
            [ARRIVAL_STATE_LABELS.LATE]: '#f43f5e',
            [ARRIVAL_STATE_LABELS.EARLY]: '#3b82f6',
            [ARRIVAL_STATE_LABELS.NO_COMMITMENT]: '#94a3b8',
            [ARRIVAL_STATE_LABELS.NO_ARRIVAL]: '#f59e0b',
        };
        return [...map.entries()]
            .map(([name, count]) => ({ name, count, fill: colorFor[name] ?? '#94a3b8' }))
            .sort((a, b) => b.count - a.count);
    }, [trips]);

    const total = kpis?.totalTripsEvaluated ?? 0;
    // Counted in the aggregation route, like every other number here, so no tab can disagree.
    const coverageRows = [
        { label: 'Arrival time recorded', count: total - (kpis?.missingArrivalCount ?? 0) },
        { label: 'Trip remarks written', count: kpis?.tripsWithRemarks ?? 0 },
        { label: 'Budget lines recorded', count: kpis?.tripsWithBudgetLines ?? 0 },
        { label: 'Notice to Explain raised', count: kpis?.tripsWithNte ?? 0 },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Chart 1 — arrival gap distribution */}
            <div className={`${PANEL} lg:col-span-7 border-emerald-500/20 hover:shadow-emerald-500/10 hover:border-emerald-500/50 hover:ring-1 hover:ring-emerald-500/30`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-rose-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                <BarChart3 className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground">How Far Arrivals Landed From The Promise</h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {kpis?.measurableTripsCount ?? 0} trip(s) that promised an arrival time, grouped by the size of the miss.
                        </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 whitespace-nowrap">
                        ±{kpis?.toleranceMinutes ?? 0} min window
                    </span>
                </div>

                <div className="h-60 w-full mt-2">
                    {bucketData.every((b) => b.trips === 0) ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            No trip in this period promised an arrival time, so the gap cannot be plotted.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bucketData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                                {/* Custom wrapped tick replaces the rotated label; height reserves space for 3 lines. */}
                                <XAxis
                                    dataKey="label"
                                    tick={<WrappedTick />}
                                    tickLine={false}
                                    axisLine={{ opacity: 0.2 }}
                                    interval={0}
                                    height={56}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'currentColor' }}
                                    tickLine={false}
                                    axisLine={{ opacity: 0.2 }}
                                    allowDecimals={false}
                                    className="text-muted-foreground"
                                />
                                <Tooltip content={<CustomTripCountTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.15)', radius: 6 }} />
                                <Bar dataKey="trips" name="Trips" radius={[4, 4, 0, 0]} maxBarSize={44}>
                                    {bucketData.map((_, idx) => (
                                        <Cell key={idx} fill={BUCKET_COLORS[idx % BUCKET_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Panel 3 — evidence coverage */}
            <div className={`${PANEL} lg:col-span-5 border-amber-500/20 hover:shadow-amber-500/10 hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/30`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <ShieldQuestion className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">What The Records Actually Carry</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                    Out of {total} posted trip(s), counting only what this app records.
                </p>
                <div className="space-y-2.5">
                    {coverageRows.map((row) => {
                        const share = total > 0 ? Math.round((row.count / total) * 100) : 0;
                        return (
                            <div key={row.label} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-medium text-foreground">{row.label}</span>
                                    <span className="text-muted-foreground tabular-nums">
                                        {row.count} / {total}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${share === 0
                                            ? 'bg-muted-foreground/30'
                                            : share < 25
                                                ? 'bg-rose-500'
                                                : share < 60
                                                    ? 'bg-amber-500'
                                                    : 'bg-emerald-500'
                                            }`}
                                        // A stub on a zero row reads as "a tiny amount" rather than "none",
                                        // so nothing is drawn until the count is real.
                                        style={{ width: `${share === 0 ? 0 : Math.max(share, 2)}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 pt-2.5 border-t border-border/60">
                    {EVIDENCE_OUT_OF_SCOPE_NOTE}
                </p>
            </div>

            {/* Chart 2 — route reliability comparison */}
            <div className={`${PANEL} lg:col-span-12 border-blue-500/20 hover:shadow-blue-500/10 hover:border-blue-500/50 hover:ring-1 hover:ring-blue-500/30`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <Route className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground">Route Reliability Comparison</h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Share of trips that arrived inside the window, busiest lanes first.
                        </p>
                    </div>
                    {verdictData.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                            {verdictData.map((v) => (
                                <span
                                    key={v.name}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border/50 text-[11px] text-foreground font-medium whitespace-nowrap shadow-2xs"
                                >
                                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: v.fill }} />
                                    <span>{v.name}: <span className="font-bold">{v.count}</span></span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="h-60 w-full mt-2">
                    {routeData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            No lane in this period carried an arrival commitment, so routes cannot be compared.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={routeData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                                {/* Custom wrapped tick replaces the rotated label; height reserves space for 3 lines. */}
                                <XAxis
                                    dataKey="label"
                                    tick={<WrappedTick />}
                                    tickLine={false}
                                    axisLine={{ opacity: 0.2 }}
                                    interval={0}
                                    height={56}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'currentColor' }}
                                    tickLine={false}
                                    axisLine={{ opacity: 0.2 }}
                                    tickFormatter={(val) => `${val}%`}
                                    domain={[0, 100]}
                                    className="text-muted-foreground"
                                />
                                <Tooltip content={<CustomRateTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.15)', radius: 6 }} />
                                <Bar dataKey="onTime" name="Arrived on time" radius={[4, 4, 0, 0]} maxBarSize={44} minPointSize={4}>
                                    {routeData.map((r) => (
                                        <Cell key={r.routeKey} fill={r.scoreTone} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};
