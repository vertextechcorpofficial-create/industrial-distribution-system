/**
 * View 3 — Late Shipment Root Cause & Evidence grid
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Lateness is split into the origin-branch leg (left late) and the road leg (took longer than allowed) so a
 *   driver is not blamed for a vehicle that never rolled out on time.
 * - Evidence only ever quotes what a person typed or signed; blank evidence reads as "Not logged".
 */

'use client';

import React, { useMemo } from 'react';
import { LateShipmentRootCauseRow, RootCauseCategory } from '../types';
import { GridColumn, GridShell, StatePill } from './GridShell';
import {
    formatDurationMinutes,
    ROOT_CAUSE_LABELS,
} from '../services/logisticsMetrics';
import { Camera, MapPin, FileWarning, MessageSquareText } from 'lucide-react';

interface LateShipmentRootCauseGridProps {
    lateShipments: LateShipmentRootCauseRow[];
    toleranceMinutes: number;
    onOpenTrip: (tripId: number) => void;
    selectedTripId: number | null;
}

const CATEGORY_TONE: Record<RootCauseCategory, 'rose' | 'amber' | 'blue' | 'neutral'> = {
    DEPOT_DISPATCH_DELAY: 'amber',
    ROAD_TRANSIT_DELAY: 'rose',
    DEPOT_AND_ROAD_DELAY: 'rose',
    ARRIVAL_RECORDING_GAP: 'blue',
    NOT_LATE: 'neutral',
    NOT_MEASURABLE: 'neutral',
};

export const LateShipmentRootCauseGrid: React.FC<LateShipmentRootCauseGridProps> = ({
    lateShipments,
    toleranceMinutes,
    onOpenTrip,
    selectedTripId,
}) => {
    const categoryCounts = useMemo(() => {
        const map = new Map<RootCauseCategory, number>();
        for (const row of lateShipments) {
            map.set(row.rootCauseCategory, (map.get(row.rootCauseCategory) ?? 0) + 1);
        }
        // Worst-first ordering keeps the actionable categories at the left of the strip.
        const order: RootCauseCategory[] = [
            'DEPOT_AND_ROAD_DELAY',
            'ROAD_TRANSIT_DELAY',
            'DEPOT_DISPATCH_DELAY',
            'ARRIVAL_RECORDING_GAP',
            'NOT_MEASURABLE',
        ];
        return order.filter((k) => map.has(k)).map((k) => ({ category: k, trips: map.get(k) as number }));
    }, [lateShipments]);

    const columns: Array<GridColumn<LateShipmentRootCauseRow>> = [
        {
            key: 'docNo',
            label: 'Trip No.',
            sortValue: (r) => r.docNo,
            render: (r) => (
                <div>
                    <div className="font-semibold text-foreground">{r.docNo}</div>
                </div>
            ),
        },
        {
            key: 'route',
            label: 'Route',
            sortValue: (r) => r.clusterName,
            render: (r) => (
                <div>
                    <div className="text-foreground">{r.clusterName}</div>

                </div>
            ),
        },
        {
            key: 'vehicle',
            label: 'Vehicle / Driver',
            sortValue: (r) => r.driverName,
            // The cell prints both plate and driver, so both have to answer to the filter box.
            searchValue: (r) => `${r.vehiclePlate} ${r.driverName}`,
            render: (r) => (
                <div>
                    <div className="font-medium text-foreground">{r.vehiclePlate}</div>
                    <div className="text-[11px] text-muted-foreground">{r.driverName}</div>
                </div>
            ),
        },
        {
            key: 'etaErrorMinutes',
            label: 'How Late',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.etaErrorMinutes,
            render: (r) => (
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                    +{formatDurationMinutes(r.etaErrorMinutes)}
                </span>
            ),
        },
        {
            key: 'rootCause',
            label: 'Delay Reason',
            sortValue: (r) => r.rootCauseCategory,
            // The pill prints plain words over a stored code, so the filter box matches the words.
            searchValue: (r) => ROOT_CAUSE_LABELS[r.rootCauseCategory],
            render: (r) => (
                <StatePill tone={CATEGORY_TONE[r.rootCauseCategory]}>
                    {ROOT_CAUSE_LABELS[r.rootCauseCategory]}
                </StatePill>
            ),
        },
        {
            key: 'depotLag',
            label: 'Dispatch Delay',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.departureLagMinutes,
            render: (r) => {
                if (r.departureLagMinutes === null) return <span className="text-muted-foreground">—</span>;
                const late = r.departureLagMinutes > toleranceMinutes;
                return (
                    <span className={late ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground'}>
                        {late ? '+' : ''}
                        {formatDurationMinutes(r.departureLagMinutes)}
                    </span>
                );
            },
        },
        {
            key: 'transitLag',
            label: 'Time On Road',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.transitLagMinutes,
            render: (r) => <span className="text-foreground">{formatDurationMinutes(r.transitLagMinutes)}</span>,
        },
        {
            key: 'stops',
            label: 'Stops Affected',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.unfulfilledStops,
            render: (r) => (
                <div>
                    <span className="text-foreground font-medium">{r.stopsCount}</span>
                    <span className="text-muted-foreground"> total</span>
                    <div className="text-[10px] text-rose-600 dark:text-rose-400">
                        {r.unfulfilledStops} unfulfilled · {r.returnsStops} returned
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-3">
            {/* Delay breakdown: how the lateness splits across depot rollout vs transit */}
            <div className="bg-card border border-rose-500/20 rounded-xl p-3 flex items-center flex-wrap gap-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                    Delay Breakdown
                </span>
                {categoryCounts.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">
                        No trip in this period arrived later than the {toleranceMinutes}-minute window.
                    </span>
                ) : (
                    categoryCounts.map((entry) => (
                        <StatePill key={entry.category} tone={CATEGORY_TONE[entry.category]}>
                            {ROOT_CAUSE_LABELS[entry.category]}: {entry.trips}
                        </StatePill>
                    ))
                )}
            </div>

            <GridShell<LateShipmentRootCauseRow>
                title="Late Trips and the Record Behind Them"
                subtitle={`${lateShipments.length} trip(s) arrived more than ${toleranceMinutes} min after the promised time · select a row for the stop-by-stop evidence`}
                rows={lateShipments}
                columns={columns}
                rowKey={(r) => r.tripId}
                onRowClick={(r) => onOpenTrip(r.tripId)}
                activeRowKey={selectedTripId}
                emptyMessage="No late arrivals under the current tolerance and filters."
                defaultSortKey="etaErrorMinutes"
                defaultSortDirection="desc"
            />
        </div>
    );
};
