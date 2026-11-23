/**
 * View 4 — Fleet Activity grid
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - The plan asked for utilisation against rated capacity plus fuel burn. The industrial fleet register
 *   carries no capacity, odometer or fuel allocation for these trips, so this view reports the activity
 *   the documents do support (trips, days used, stops, units, peso per unit) and shows the fuel column
 *   only when at least one trip actually logged litres.
 */

'use client';

import React from 'react';
import { FleetActivityRow } from '../types';
import { GridColumn, GridShell, StatePill } from './GridShell';
import { formatPeso, formatPercent, plural } from '../services/logisticsMetrics';

interface FleetActivityGridProps {
    fleet: FleetActivityRow[];
}

export const FleetActivityGrid: React.FC<FleetActivityGridProps> = ({ fleet }) => {
    const hasFuel = fleet.some((v) => (v.totalFuelLiters ?? 0) > 0);

    const columns: Array<GridColumn<FleetActivityRow>> = [
        {
            key: 'vehicle',
            label: 'Vehicle',
            sortValue: (r) => r.vehiclePlate,
            // The cell prints plate, name and type, so all three have to answer to the filter box.
            searchValue: (r) => `${r.vehiclePlate} ${r.vehicleName} ${r.vehicleType ?? ''}`,
            render: (r) => (
                <div>
                    <div className="font-semibold text-foreground">{r.vehiclePlate}</div>
                    <div className="text-[11px] text-muted-foreground">
                        {r.vehicleName}
                        {r.vehicleType ? ` · ${r.vehicleType}` : ''}
                    </div>
                </div>
            ),
        },
        {
            key: 'homeBranch',
            label: 'Home Branch',
            sortValue: (r) => r.registeredHomeBranch ?? '',
            render: (r) => (
                <span className={r.registeredHomeBranch ? 'text-foreground' : 'text-muted-foreground'}>
                    {r.registeredHomeBranch ?? '-'}
                </span>
            ),
        },
        {
            key: 'totalTrips',
            label: 'Trips',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.totalTrips,
            render: (r) => <span className="font-semibold text-foreground">{r.totalTrips}</span>,
        },
        {
            key: 'activeDays',
            label: 'Days Used',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.activeDays,
            render: (r) => <span className="text-foreground">{r.activeDays}</span>,
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
                    <div className="text-[10px] text-muted-foreground">
                        {r.averageStopsPerTrip !== null ? `${plural(r.averageStopsPerTrip, 'stop')} per trip` : '—'}
                    </div>
                </div>
            ),
        },
        {
            key: 'shortfall',
            label: 'Unfulfilled / Returned',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.unfulfilledStops,
            render: (r) =>
                r.unfulfilledStops === 0 && r.returnsStops === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">Clean</span>
                ) : (
                    <span className="text-rose-600 dark:text-rose-400 text-[11px] font-semibold">
                        {r.unfulfilledStops} unfulfilled · {r.returnsStops} returned
                    </span>
                ),
        },
        {
            key: 'onTime',
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
            key: 'cost',
            label: 'Trip Budget',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.totalCost,
            render: (r) => <span className="font-semibold text-foreground">{formatPeso(r.totalCost)}</span>,
        },
        {
            key: 'costPerUnit',
            label: 'Cost / Unit',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.costPerDeliveredUnit,
            render: (r) =>
                r.costPerDeliveredUnit === null ? (
                    <span className="text-muted-foreground">No units</span>
                ) : (
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                        {formatPeso(r.costPerDeliveredUnit)}
                    </span>
                ),
        },
        ...(hasFuel
            ? [
                  {
                      key: 'fuel',
                      label: 'Fuel Logged',
                      align: 'right',
                      cellClassName: 'tabular-nums',
                      sortValue: (r) => r.totalFuelLiters,
                      render: (r) =>
                          r.totalFuelLiters && r.totalFuelLiters > 0 ? (
                              <span className="text-foreground">{r.totalFuelLiters.toLocaleString()} L</span>
                          ) : (
                              <span className="text-muted-foreground">Not logged</span>
                          ),
                  } as GridColumn<FleetActivityRow>,
              ]
            : []),
        {
            key: 'capacity',
            label: 'Maximum Capacity',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.ratedWeightKg ?? 0,
            render: (r) => {
                if (r.ratedWeightKg !== null && r.ratedWeightKg !== undefined) {
                    return (
                        <span className="text-foreground font-medium">
                            {r.ratedWeightKg > 0 ? `${r.ratedWeightKg.toLocaleString()} kg` : '0.00 kg'}
                            {r.ratedCbm ? ` · ${r.ratedCbm} m³` : ''}
                        </span>
                    );
                }
                return <span className="text-muted-foreground">-</span>;
            },
        },
    ];

    // The fine print: fuel telemetry is captured separately per allocation slip.
    const notLogged = !hasFuel ? 'fuel allocation' : '';

    return (
        <GridShell<FleetActivityRow>
            title="Vehicle Activity and Cost Efficiency"
            subtitle={`${plural(fleet.length, 'vehicle')} dispatched in this period${
                notLogged ? ` · ${notLogged} is not logged for these trips` : ''
            }`}
            rows={fleet}
            columns={columns}
            rowKey={(r) => r.vehiclePlate || String(r.vehicleId)}
            emptyMessage="No vehicle was dispatched under the applied filters."
            defaultSortKey="totalTrips"
            defaultSortDirection="desc"
        />
    );
};
