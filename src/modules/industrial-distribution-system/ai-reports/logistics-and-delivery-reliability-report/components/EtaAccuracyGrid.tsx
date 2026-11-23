/**
 * View 1 — Delivery ETA Accuracy grid
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Every trip is listed, including the ones that carry no arrival promise, so the exclusion behind
 *   the headline rate is auditable row by row rather than hidden in a filter.
 */

'use client';

import React from 'react';
import { ArrivalState, TripSummaryRow } from '../types';
import { GridColumn, GridShell, StatePill } from './GridShell';
import {
    ARRIVAL_STATE_LABELS,
    formatPhDateTime,
    formatSignedDuration,
} from '../services/logisticsMetrics';

interface EtaAccuracyGridProps {
    trips: TripSummaryRow[];
    toleranceMinutes: number;
    onSelectTrip: (trip: TripSummaryRow) => void;
    selectedTripId: number | null;
}

const TONE: Record<ArrivalState, 'emerald' | 'amber' | 'rose' | 'blue' | 'neutral'> = {
    ON_TIME: 'emerald',
    LATE: 'rose',
    EARLY: 'blue',
    NO_COMMITMENT: 'neutral',
    NO_ARRIVAL: 'amber',
};

export const EtaAccuracyGrid: React.FC<EtaAccuracyGridProps> = ({
    trips,
    toleranceMinutes,
    onSelectTrip,
    selectedTripId,
}) => {
    const columns: Array<GridColumn<TripSummaryRow>> = [
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
            label: 'Destination / Route',
            sortValue: (r) => `${r.clusterName}__${r.depotBranchName}`,
            render: (r) => (
                <div>
                    <div className="font-semibold text-foreground">{r.clusterName}</div>

                </div>
            ),
        },
        {
            key: 'vehicle',
            label: 'Vehicle / Driver',
            sortValue: (r) => r.vehiclePlate,
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
            key: 'plannedArrival',
            label: 'Promised Arrival',
            sortValue: (r) => r.plannedArrival,
            render: (r) => (
                <span className={r.hasArrivalCommitment ? 'text-foreground' : 'text-muted-foreground'}>
                    {r.hasArrivalCommitment ? formatPhDateTime(r.plannedArrival) : 'Not promised'}
                </span>
            ),
        },
        {
            key: 'actualArrival',
            label: 'Recorded Arrival',
            sortValue: (r) => r.actualArrival,
            render: (r) => <span className="text-foreground">{formatPhDateTime(r.actualArrival)}</span>,
        },
        {
            key: 'gap',
            label: 'Gap vs Promise',
            align: 'right',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.etaErrorMinutes,
            render: (r) => {
                if (!r.hasArrivalCommitment || r.etaErrorMinutes === null) {
                    return <span className="text-muted-foreground">—</span>;
                }
                const isLate = r.etaErrorMinutes > toleranceMinutes;
                const isEarly = r.etaErrorMinutes < -toleranceMinutes;
                return (
                    <span
                        className={`font-semibold ${isLate
                                ? 'text-rose-600 dark:text-rose-400'
                                : isEarly
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                    >
                        {formatSignedDuration(r.etaErrorMinutes)}
                    </span>
                );
            },
        },
        {
            key: 'verdict',
            label: 'Verdict',
            align: 'center',
            sortValue: (r) => r.arrivalState,
            // Searching has to answer to the words on the pill, not to the stored code behind it.
            searchValue: (r) => ARRIVAL_STATE_LABELS[r.arrivalState],
            render: (r) => <StatePill tone={TONE[r.arrivalState]}>{ARRIVAL_STATE_LABELS[r.arrivalState]}</StatePill>,
        },
        {
            key: 'stops',
            label: 'Stops',
            align: 'center',
            cellClassName: 'tabular-nums',
            sortValue: (r) => r.stopsCount,
            render: (r) => (
                <div>
                    <span className="text-foreground font-medium">{r.stopsCount}</span>
                    {r.unfulfilledStops > 0 && (
                        <span className="ml-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            {r.unfulfilledStops} unfulfilled
                        </span>
                    )}
                </div>
            ),
        },
    ];

    const onTime = trips.filter((t) => t.arrivalState === 'ON_TIME').length;

    return (
        <GridShell<TripSummaryRow>
            title="Trip-level Arrival Accuracy"
            subtitle={`${trips.length} posted trip(s) · ${onTime} met the ${toleranceMinutes}-minute window · select a row for the full evidence trail`}
            rows={trips}
            columns={columns}
            rowKey={(r) => r.tripId}
            onRowClick={onSelectTrip}
            activeRowKey={selectedTripId}
            emptyMessage="No posted trips matched the applied filters."
            defaultSortKey="gap"
            defaultSortDirection="desc"
        />
    );
};
