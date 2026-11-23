/**
 * View 2 — Route Performance grid
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - A route is origin branch → destination cluster, which is the only leg the dispatch documents actually name.
 * - The measurable column is shown beside the rate so a 100% drawn from two trips is not read as proven.
 */

'use client';

import React from 'react';
import { RoutePerformanceRow } from '../types';
import { GridColumn, GridShell, StatePill } from './GridShell';
import { formatDurationMinutes, formatPeso, formatPercent, plural } from '../services/logisticsMetrics';

interface RouteComparisonGridProps {
    routes: RoutePerformanceRow[];
    toleranceMinutes: number;
}

export const RouteComparisonGrid: React.FC<RouteComparisonGridProps> = ({
    routes,
    toleranceMinutes,
}) => {
    const columns: Array<GridColumn<RoutePerformanceRow>> = [
        {
            key: 'route',
            label: 'Route',
            sortValue: (r) => `${r.depotBranchName}__${r.destinationCluster}`,
            render: (r) => (
                <div>
                    <div className="font-semibold text-foreground">{r.destinationCluster}</div>

                </div>
            ),
        },
        {
            key: 'trips',
            label: 'Trips',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.totalTrips,
            render: (r) => (
                <div>
                    <div className="font-semibold text-foreground">{r.totalTrips}</div>
                    <div className="text-[10px] text-muted-foreground">{r.measurableTrips} scored</div>
                </div>
            ),
        },
        {
            key: 'onTimeRate',
            label: 'On-time',
            align: 'center',
            sortValue: (r) => r.onTimeRatePercentage,
            render: (r) =>
                r.onTimeRatePercentage === null ? (
                    <StatePill tone="neutral">No promise</StatePill>
                ) : (
                    <StatePill
                        tone={
                            r.onTimeRatePercentage >= 85
                                ? 'emerald'
                                : r.onTimeRatePercentage >= 60
                                    ? 'amber'
                                    : 'rose'
                        }
                    >
                        {formatPercent(r.onTimeRatePercentage)}
                    </StatePill>
                ),
        },
        {
            key: 'late',
            label: 'Late',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.lateTrips,
            render: (r) => (
                <span className={r.lateTrips > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-muted-foreground'}>
                    {r.lateTrips} late
                </span>
            ),
        },
        {
            // Without this column a lane can read 100% on-time next to a 19-day gap and look broken:
            // arriving early counts as on time, yet still misses the promised arrival clock.
            key: 'early',
            label: 'Early',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.earlyTrips,
            render: (r) => (
                <span className={r.earlyTrips > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-muted-foreground'}>
                    {r.earlyTrips} early
                </span>
            ),
        },
        {
            key: 'mae',
            label: 'Avg Gap (early or late)',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.meanAbsoluteErrorMinutes,
            render: (r) => (
                <span className="text-foreground font-medium">
                    {formatDurationMinutes(r.meanAbsoluteErrorMinutes)}
                </span>
            ),
        },
        {
            key: 'median',
            label: 'Median Gap (− = early)',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.medianEtaErrorMinutes,
            render: (r) => <span className="text-muted-foreground">{formatDurationMinutes(r.medianEtaErrorMinutes)}</span>,
        },
        {
            key: 'stops',
            label: 'Stops / Units',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.totalStops,
            render: (r) => (
                <div>
                    <span className="text-foreground font-medium">{plural(r.totalStops, 'stop')}</span>
                    <span className="text-muted-foreground"> · {plural(r.totalDeliveredUnits, 'unit')}</span>
                </div>
            ),
        },
        {
            key: 'cost',
            label: 'Trip Budget',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.totalRouteCost,
            render: (r) => (
                <div>
                    <div className="font-semibold text-foreground">{formatPeso(r.totalRouteCost)}</div>
                    <div className="text-[10px] text-muted-foreground">
                        {formatPeso(r.averageCostPerTrip)} per trip
                    </div>
                </div>
            ),
        },
        {
            key: 'costPerUnit',
            label: 'Cost / Unit',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.costPerDeliveredUnit,
            render: (r) =>
                r.costPerDeliveredUnit === null ? (
                    <span className="text-muted-foreground">—</span>
                ) : (
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                        {formatPeso(r.costPerDeliveredUnit)}
                    </span>
                ),
        },
    ];

    return (
        <GridShell<RoutePerformanceRow>
            title="Route Reliability and Cost Comparison"
            subtitle={`${routes.length} branch-to-cluster lane(s) · on-time measured only where an arrival was promised (±${toleranceMinutes} min)`}
            rows={routes}
            columns={columns}
            rowKey={(r) => r.routeKey}
            emptyMessage="No routes were dispatched in the applied period."
            defaultSortKey="onTimeRate"
            defaultSortDirection="asc"
        />
    );
};
