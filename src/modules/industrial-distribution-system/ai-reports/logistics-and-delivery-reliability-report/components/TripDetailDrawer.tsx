/**
 * Trip Evidence Drawer — Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Slide-over sheet that shows the four dispatch clocks, the verdict they produce, the stop-by-stop
 *   outcome with the driver's own remarks, and the trip budget lines.
 * - Stops paginate client-side (6 per page); the clocks and cost stay above the fold.
 * - Stop statuses print the word the Clearance screen uses ("Unfulfilled"), not the stored
 *   "Not Fulfilled"; only the label changes, every comparison still reads the stored value.
 */

'use client';

import React, { useState } from 'react';
import { TripSummaryRow } from '../types';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { StatePill } from './GridShell';
import {
    ARRIVAL_STATE_LABELS,
    formatDurationMinutes,
    formatPesoPrecise,
    formatPhDateTime,
    stopOutcomeLabel,
} from '../services/logisticsMetrics';
import {
    Truck,
    Clock,
    MapPin,
    User,
    Wallet,
    PackageCheck,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Camera,
} from 'lucide-react';

interface TripDetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    trip: TripSummaryRow | null;
    toleranceMinutes: number;
}

const STOP_PAGE_SIZE = 6;

export const TripDetailDrawer: React.FC<TripDetailDrawerProps> = ({
    isOpen,
    onClose,
    trip,
    toleranceMinutes,
}) => {
    const [stopPage, setStopPage] = useState(1);

    // Reset to the first stop page when a different trip is opened, derived during render.
    const [prevTripId, setPrevTripId] = useState(trip?.tripId);
    if (trip?.tripId !== prevTripId) {
        setPrevTripId(trip?.tripId);
        setStopPage(1);
    }

    if (!trip) return null;

    const totalStops = trip.stops.length;
    const totalStopPages = Math.ceil(totalStops / STOP_PAGE_SIZE) || 1;
    const visibleStops = trip.stops.slice((stopPage - 1) * STOP_PAGE_SIZE, stopPage * STOP_PAGE_SIZE);

    const verdictTone =
        trip.arrivalState === 'ON_TIME'
            ? 'emerald'
            : trip.arrivalState === 'LATE'
            ? 'rose'
            : trip.arrivalState === 'EARLY'
            ? 'blue'
            : trip.arrivalState === 'NO_ARRIVAL'
            ? 'amber'
            : 'neutral';

    const clocks: Array<{ label: string; planned: string; actual: string; delta: number | null; deltaLabel: string }> = [
        {
            label: 'Leaving the branch',
            planned: formatPhDateTime(trip.plannedDeparture),
            actual: formatPhDateTime(trip.actualDeparture),
            delta: trip.departureLagMinutes,
            deltaLabel: 'vs planned roll-out',
        },
        {
            label: 'Arriving at destination',
            planned: trip.hasArrivalCommitment ? formatPhDateTime(trip.plannedArrival) : 'No arrival time promised',
            actual: formatPhDateTime(trip.actualArrival),
            delta: trip.etaErrorMinutes,
            deltaLabel: 'vs promised arrival',
        },
    ];

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6 bg-background">
                <SheetHeader className="pb-4 border-b border-border/80">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Truck className="h-5 w-5 text-primary" />
                        <SheetTitle className="text-lg font-bold text-foreground">{trip.docNo}</SheetTitle>
                        <StatePill tone={verdictTone}>{ARRIVAL_STATE_LABELS[trip.arrivalState]}</StatePill>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            {trip.status}
                        </span>
                    </div>
                    <SheetDescription className="text-xs text-muted-foreground mt-1 flex items-center flex-wrap gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {trip.depotBranchName} → {trip.clusterName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {trip.driverName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <Truck className="h-3.5 w-3.5" />
                            {trip.vehiclePlate} {trip.vehicleName ? `· ${trip.vehicleName}` : ''}
                        </span>
                       
                    </SheetDescription>
                </SheetHeader>

                {/* Verdict summary */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">On-time window:</span>
                        <span className="font-bold text-foreground">± {toleranceMinutes} min</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Gap vs promise:</span>
                        <span
                            className={`font-bold ${
                                trip.etaErrorMinutes === null
                                    ? 'text-muted-foreground'
                                    : trip.etaErrorMinutes > toleranceMinutes
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            {trip.etaErrorMinutes === null ? 'Not measurable' : formatDurationMinutes(trip.etaErrorMinutes)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Time spent on the road:</span>
                        <span className="font-bold text-foreground">
                            {formatDurationMinutes(trip.transitLagMinutes)}
                        </span>
                    </div>
 
                </div>

                {/* Four dispatch clocks */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-primary" />
                        Dispatch Clocks
                    </h3>
                    <div className="space-y-2">
                        {clocks.map((clock) => (
                            <div key={clock.label} className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
                                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                    {clock.label}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <div className="text-[10px] text-muted-foreground">Planned</div>
                                        <div className={clock.planned.startsWith('No ') ? 'text-muted-foreground italic' : 'font-semibold text-foreground'}>
                                            {clock.planned}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground">Recorded</div>
                                        <div className="font-semibold text-foreground">
                                            {clock.actual === '—' ? 'Not closed out' : clock.actual}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    {clock.delta === null
                                        ? `No ${clock.deltaLabel.replace('vs ', '')} can be computed.`
                                        : `${clock.deltaLabel}: ${formatDurationMinutes(clock.delta)}`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Delivery outcome counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Stops', value: trip.stopsCount, icon: MapPin, tone: 'text-foreground' },
                        { label: 'Fulfilled', value: trip.fulfilledStops, icon: PackageCheck, tone: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Unfulfilled', value: trip.unfulfilledStops, icon: AlertTriangle, tone: 'text-rose-600 dark:text-rose-400' },
                        { label: 'Units', value: trip.deliveredUnits, icon: Truck, tone: 'text-blue-600 dark:text-blue-400' },
                    ].map((cell) => (
                        <div key={cell.label} className="p-3 bg-muted/30 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                <cell.icon className="h-3.5 w-3.5" />
                                {cell.label}
                            </span>
                            <div className={`text-xl font-bold mt-1 ${cell.tone}`}>{cell.value}</div>
                        </div>
                    ))}
                </div>

                {/* Trip budget */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Wallet className="h-4 w-4 text-purple-500" />
                        Trip Budget ({trip.expenses.length} line{trip.expenses.length === 1 ? '' : 's'})
                    </h3>
                    {trip.expenses.length === 0 ? (
                        <div className="p-3 bg-muted/20 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                            No budget lines were charged to this dispatch.
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border overflow-hidden">
                            <table className="w-full text-xs">
                                <tbody className="divide-y divide-border/60">
                                    {trip.expenses.map((exp, idx) => (
                                        <tr key={`${exp.coaId}-${idx}`}>
                                            <td className="py-2 px-3 text-foreground">
                                                <div className="font-medium">{exp.accountTitle ?? 'Unmapped account'}</div>
                                                {exp.remarks && (
                                                    <div className="text-[10px] text-muted-foreground">{exp.remarks}</div>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-right tabular-nums font-semibold text-foreground">
                                                {formatPesoPrecise(exp.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-muted/40">
                                        <td className="py-2 px-3 font-bold text-foreground">Total approved for the trip</td>
                                        <td className="py-2 px-3 text-right tabular-nums font-bold text-purple-600 dark:text-purple-400">
                                            {formatPesoPrecise(trip.tripCost)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    {trip.costPerDeliveredUnit !== null && (
                        <p className="text-[11px] text-muted-foreground">
                            {formatPesoPrecise(trip.costPerDeliveredUnit)} per unit delivered on this trip.
                        </p>
                    )}
                </div>

                {/* Stop-by-stop evidence */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <PackageCheck className="h-4 w-4 text-emerald-500" />
                            Stop-by-stop Evidence
                        </h3>
                        {totalStopPages > 1 && (
                            <span className="text-[10px] text-muted-foreground">
                                Page {stopPage} of {totalStopPages}
                            </span>
                        )}
                    </div>

                    {totalStops === 0 ? (
                        <div className="p-4 bg-muted/20 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                            No invoices were attached to this dispatch.
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {visibleStops.map((stop) => {
                                const problem = stop.outcome !== 'Fulfilled';
                                return (
                                    <div
                                        key={stop.stopId}
                                        className={`p-3.5 rounded-xl border space-y-1.5 ${
                                            problem
                                                ? 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20'
                                                : 'border-border bg-muted/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                                                    #{stop.sequence ?? '—'}
                                                </span>
                                                <span className="text-xs font-bold text-foreground truncate">
                                                    {stop.customerName ?? stop.invoiceNo ?? 'Unassigned customer'}
                                                </span>
                                            </div>
                                            <StatePill tone={problem ? 'rose' : 'emerald'}>{stopOutcomeLabel(stop.outcome)}</StatePill>
                                        </div>

                                        {stop.invoiceNo && (
                                            <div className="text-[10px] text-muted-foreground">
                                                Invoice {stop.invoiceNo}
                                                {stop.customerCode ? ` · Code ${stop.customerCode}` : ''} ·{' '}
                                                {stop.deliveredUnits} unit(s)
                                            </div>
                                        )}

                                        {stop.products.length > 0 && (
                                            <div className="flex items-center flex-wrap gap-1">
                                                {stop.products.slice(0, 6).map((p) => (
                                                    <span
                                                        key={`${stop.stopId}-${p.productId}`}
                                                        className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground"
                                                    >
                                                        {p.description} ×{p.quantity}
                                                    </span>
                                                ))}
                                                {stop.products.length > 6 && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        +{stop.products.length - 6} more
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {stop.remarks && (
                                            <p className={`text-xs font-medium leading-snug ${problem ? 'text-rose-900 dark:text-rose-300' : 'text-foreground'}`}>
                                                &ldquo;{stop.remarks}&rdquo;
                                            </p>
                                        )}

                                        {stop.nteDocNos.length > 0 && (
                                            <div className="flex items-center gap-1 flex-wrap text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                                <AlertTriangle className="h-3 w-3" />
                                                Notice to Explain: {stop.nteDocNos.join(', ')}
                                            </div>
                                        )}

                                        {stop.proofOutcome ? (
                                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                                                <Camera className="h-3 w-3" />
                                                Proof {stop.proofOutcome.toLowerCase()}
                                                {stop.proofRecipientName ? ` · received by ${stop.proofRecipientName}` : ''}
                                            </div>
                                        ) : (
                                            problem && (
                                                <div className="text-[10px] text-muted-foreground italic">
                                                    No delivery proof logged for this stop.
                                                </div>
                                            )
                                        )}

                                        {stop.proofRemarks && (
                                            <p className="text-[11px] text-muted-foreground leading-snug">
                                                Proof note: {stop.proofRemarks}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}

                            {totalStopPages > 1 && (
                                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                                    <span className="text-[11px] text-muted-foreground">
                                        Showing {(stopPage - 1) * STOP_PAGE_SIZE + 1} to{' '}
                                        {Math.min(stopPage * STOP_PAGE_SIZE, totalStops)} of {totalStops}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setStopPage((p) => Math.max(p - 1, 1))}
                                            disabled={stopPage === 1}
                                            className="p-1 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                                            title="Previous stops"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStopPage((p) => Math.min(p + 1, totalStopPages))}
                                            disabled={stopPage === totalStopPages}
                                            className="p-1 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                                            title="Next stops"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {trip.remarks && (
                    <div className="p-3 rounded-xl border border-border bg-muted/20">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Dispatch remarks
                        </div>
                        <p className="text-xs text-foreground leading-snug">{trip.remarks}</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};
