/**
 * Pure calculation rules for the Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * These helpers are shared by the aggregation route so every screen and the PDF quote one rule set.
 *
 * TIMEZONE RULE (important, learned from live data):
 * Directus serialises the dispatch datetime columns as Philippine wall clock carrying a synthetic
 * trailing "Z". Passing them through `new Date().toLocaleString()` therefore shifts every clock by
 * the viewer's own offset and shows a wrong time. All four dispatch timestamps on a row share the
 * same frame, so durations and day parts are correct as-is; only the *display* must avoid shifting.
 *
 * Revisions:
 * - Added getCurrentMonthRange() and createDefaultFilter() so the report opens (and Reset returns)
 *   on the current calendar month. createDefaultFilter uses DEFAULT_ON_TIME_TOLERANCE_MINUTES so a
 *   fresh load agrees with the 60-minute standard window.
 */

import type {
    ArrivalState,
    EtaBucketRow,
    RootCauseCategory,
    LogisticsReportFilter,
} from '../types';

/**
 * Default on-time window. Trips arriving within this many minutes of the committed ETA count as
 * on time. 60 minutes (1 hour) is the practical default for industrial bulk freight and inter-provincial runs.
 */
export const DEFAULT_ON_TIME_TOLERANCE_MINUTES = 60;

/**
 * Tolerance choices offered in the filter bar.
 * Industrial distribution involves distant regional routes (e.g. Pangasinan, Ilocos, La Union),
 * so options range from tight windows up to multi-hour and multi-day thresholds.
 */
export const TOLERANCE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
    { value: 0, label: '0 min (exact)' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hour (standard)' },
    { value: 120, label: '2 hours' },
    { value: 240, label: '4 hours' },
    { value: 480, label: '8 hours' },
    { value: 720, label: '12 hours' },
    { value: 1440, label: '1 day (24h)' },
    { value: 2880, label: '2 days (48h)' },
];

/**
 * Governing rule for the headline on-time share and mean absolute error.
 *
 * true  = measure only trips whose committed arrival is later than their committed departure.
 *         In the in-scope industrial corpus 54 of 84 trips repeat the dispatch clock into the
 *         arrival box, so no arrival was ever promised for them. Scoring those trips as "late"
 *         measures the data-entry habit, not the transport operation.
 * false = score every trip that has any arrival timestamp (the wider, harsher reading).
 *
 * Either way the excluded trips stay visible: they are counted in `uncommittedTripsCount` and
 * rendered on the ETA tab as "No arrival time promised".
 */
export const HEADLINE_REQUIRES_ARRIVAL_COMMITMENT = true;

/** MySQL bit(1) columns arrive from Directus as { type: 'Buffer', data: [0|1] }. */
export function toFlagBit(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'object') {
        const buf = (value as { type?: string; data?: number[] }).data;
        return Array.isArray(buf) ? Number(buf[0]) || 0 : 0;
    }
    return Number(value) || 0;
}

/** Decimal columns arrive as strings; everything numeric funnels through here. */
export function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/** Epoch ms for duration maths. Null when the column is empty or unparseable. */
export function toMs(value: unknown): number | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
}

/** Day part of a dispatch timestamp, already Philippine wall clock. */
export function toPhDate(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const matched = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return matched ? matched[1] : raw.slice(0, 10);
}

/** 'YYYY-MM-DD HH:mm' in Philippine wall clock — never handed to Date, which would re-shift it. */
export function formatPhDateTime(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '—';
    const matched = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!matched) return raw;
    return `${matched[1]}-${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}`;
}

export function differenceInMinutes(later: number | null, earlier: number | null): number | null {
    if (later === null || earlier === null) return null;
    return Math.round((later - earlier) / 60000);
}

export interface TripTimingInput {
    estimatedDeparture: unknown;
    actualDeparture: unknown;
    estimatedArrival: unknown;
    actualArrival: unknown;
    toleranceMinutes: number;
}

export interface TripTimingResult {
    hasArrivalCommitment: boolean;
    etaErrorMinutes: number | null;
    departureLagMinutes: number | null;
    /** Hours actually spent between leaving the origin branch and recording arrival. */
    transitLagMinutes: number | null;
    /** Hours the plan allowed for the road leg. */
    plannedTransitMinutes: number | null;
    arrivalState: ArrivalState;
    isOnTime: boolean | null;
}

/**
 * Derives the punctuality verdict for one trip.
 *
 * Supports both minute-level timestamps and date-level scheduled promises.
 * Arriving early fulfills the delivery commitment and counts as on-time.
 */
export function evaluateTripTiming(input: TripTimingInput): TripTimingResult {
    const estDep = toMs(input.estimatedDeparture);
    const actDep = toMs(input.actualDeparture);
    const estArr = toMs(input.estimatedArrival);
    const actArr = toMs(input.actualArrival);
    const tolerance = input.toleranceMinutes;

    const departureLagMinutes = differenceInMinutes(actDep, estDep);
    const roadMinutes = differenceInMinutes(actArr, actDep);
    const plannedRoadMinutes = differenceInMinutes(estArr, estDep);

    if (actArr === null) {
        return {
            hasArrivalCommitment: Boolean(estArr || estDep),
            etaErrorMinutes: null,
            departureLagMinutes,
            transitLagMinutes: roadMinutes,
            plannedTransitMinutes: plannedRoadMinutes,
            arrivalState: 'NO_ARRIVAL',
            isOnTime: null,
        };
    }

    if (estArr === null && estDep === null) {
        return {
            hasArrivalCommitment: false,
            etaErrorMinutes: null,
            departureLagMinutes,
            transitLagMinutes: roadMinutes,
            plannedTransitMinutes: plannedRoadMinutes,
            arrivalState: 'NO_COMMITMENT',
            isOnTime: null,
        };
    }

    const estArrStr = String(input.estimatedArrival ?? '');
    const isMidnightOrIdentical =
        !estArr ||
        estArrStr.includes('00:00:00') ||
        (estDep !== null && estArr !== null && estDep === estArr);

    let etaErrorMinutes: number | null = null;
    let arrivalState: ArrivalState = 'NO_ARRIVAL';
    let isOnTime: boolean | null = null;

    if (isMidnightOrIdentical && estArr !== null) {
        // Date-level promise: scheduled for a given day
        const estDate = toPhDate(input.estimatedArrival);
        const actDate = toPhDate(input.actualArrival);

        if (actDate < estDate) {
            arrivalState = 'EARLY';
            isOnTime = true;
            etaErrorMinutes = -1440; // Delivered ahead of schedule
        } else if (actDate === estDate) {
            arrivalState = 'ON_TIME';
            isOnTime = true;
            etaErrorMinutes = 0; // Delivered on scheduled date
        } else {
            arrivalState = 'LATE';
            isOnTime = false;
            const diffDays = Math.max(
                1,
                Math.round((new Date(actDate).getTime() - new Date(estDate).getTime()) / 86400000)
            );
            etaErrorMinutes = diffDays * 1440;
        }
    } else if (estArr !== null) {
        // Explicit timestamp promise: minute-level comparison
        etaErrorMinutes = differenceInMinutes(actArr, estArr);

        if (etaErrorMinutes === null) {
            arrivalState = 'NO_COMMITMENT';
            isOnTime = null;
        } else if (etaErrorMinutes > tolerance) {
            arrivalState = 'LATE';
            isOnTime = false;
        } else if (etaErrorMinutes < -tolerance) {
            arrivalState = 'EARLY';
            isOnTime = true; // Arrived early fulfills on-time commitment
        } else {
            arrivalState = 'ON_TIME';
            isOnTime = true;
        }
    }

    return {
        hasArrivalCommitment: true,
        etaErrorMinutes,
        departureLagMinutes,
        transitLagMinutes: roadMinutes,
        plannedTransitMinutes: plannedRoadMinutes,
        arrivalState,
        isOnTime,
    };
}

export interface RootCauseInput {
    arrivalState: ArrivalState;
    etaErrorMinutes: number | null;
    departureLagMinutes: number | null;
    /** Hours actually spent between leaving the origin branch and recording arrival. */
    transitMinutes: number | null;
    /** Hours the planner allowed for the road leg. */
    plannedTransitMinutes: number | null;
    toleranceMinutes: number;
}

/**
 * Splits a late arrival into the origin branch's own delay and the delay accrued on the road.
 * Arrival delay = time on the road minus the time the plan allowed for the road.
 */
export function classifyRootCause(input: RootCauseInput): RootCauseCategory {
    if (input.arrivalState !== 'LATE') {
        // A trip with no promised arrival or no recorded arrival has no lateness to explain.
        if (input.arrivalState === 'NO_COMMITMENT' || input.arrivalState === 'NO_ARRIVAL') {
            return 'NOT_MEASURABLE';
        }
        return 'NOT_LATE';
    }
    if (input.etaErrorMinutes === null) return 'NOT_MEASURABLE';

    const depotLate =
        input.departureLagMinutes !== null && input.departureLagMinutes > input.toleranceMinutes;

    const roadLate =
        input.transitMinutes !== null &&
        input.plannedTransitMinutes !== null &&
        input.transitMinutes - input.plannedTransitMinutes > input.toleranceMinutes;

    if (depotLate && roadLate) return 'DEPOT_AND_ROAD_DELAY';
    if (depotLate) return 'DEPOT_DISPATCH_DELAY';
    if (roadLate) return 'ROAD_TRANSIT_DELAY';
    // Late against the promise, but neither leg exceeds tolerance on its own: the plan itself and
    // the recorded closures disagree, which is a documentation gap rather than an operational one.
    return 'ARRIVAL_RECORDING_GAP';
}

export const ROOT_CAUSE_LABELS: Record<RootCauseCategory, string> = {
    DEPOT_DISPATCH_DELAY: 'Dispatch Delay',
    ROAD_TRANSIT_DELAY: 'Arrival Delay',
    DEPOT_AND_ROAD_DELAY: 'Dispatch & Arrival Delay',
    ARRIVAL_RECORDING_GAP: 'Arrived Late',
    NOT_LATE: 'On Time',
    NOT_MEASURABLE: 'No ETA Set',
};

export const ARRIVAL_STATE_LABELS: Record<ArrivalState, string> = {
    ON_TIME: 'On time',
    LATE: 'Late',
    EARLY: 'Early',
    NO_COMMITMENT: 'No arrival time promised',
    NO_ARRIVAL: 'Arrival not recorded',
};

/**
 * `post_dispatch_invoices.status` is stored as "Not Fulfilled" / "Fulfilled With Returns" (capital W),
 * but the Clearance screen that writes it shows "Unfulfilled" / "Fulfilled with Returns" — the two forms
 * are translated in clearance-serial and clearance-manual. Every count here compares the stored value;
 * only these labels are shown, so a reader never meets a word the Clearance screen did not use.
 */
export const STOP_OUTCOME_LABELS: Record<string, string> = {
    Fulfilled: 'Fulfilled',
    'Not Fulfilled': 'Unfulfilled',
    'Fulfilled With Concerns': 'Fulfilled with Concerns',
    'Fulfilled With Returns': 'Fulfilled with Returns',
};

export function stopOutcomeLabel(outcome: string): string {
    return STOP_OUTCOME_LABELS[outcome] ?? outcome;
}

/**
 * The evidence a reviewer expects to see but this application never writes: no module in the codebase
 * creates proof photos, GPS traces or fuel allocations, and trip distance is stored per stop while the
 * dispatch header column stays empty. Both the screen and the PDF quote this one line instead of
 * plotting four permanent zeros.
 */
export const EVIDENCE_OUT_OF_SCOPE_NOTE =
    'Delivery proof photos, GPS traces and fuel logs are captured by systems outside this app, and distance is written per stop instead of per trip, so none of the four is counted here.';

export function mean(values: number[]): number | null {
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function meanAbsoluteError(values: number[]): number | null {
    if (!values.length) return null;
    return values.reduce((a, b) => a + Math.abs(b), 0) / values.length;
}

export function round(value: number | null, decimals = 0): number | null {
    if (value === null || !Number.isFinite(value)) return null;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

export function percentage(numerator: number, denominator: number): number | null {
    if (!denominator) return null;
    return round((numerator / denominator) * 100, 1);
}

/**
 * Human-readable lateness. Minutes below an hour stay minutes; anything larger is spoken in hours
 * so an executive reading the card does not have to divide 1,047 by 60 in their head.
 */
export function formatDurationMinutes(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '—';
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (abs < 60) return `${sign}${Math.round(abs)} min`;
    if (abs < 60 * 24) return `${sign}${(abs / 60).toFixed(1)} h`;
    return `${sign}${(abs / (60 * 24)).toFixed(1)} days`;
}

/** Peso amounts come from trip budgets; always spoken with the peso sign and no decimals. */
export function formatPeso(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function formatPesoPrecise(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `${value}%`;
}

/** Signed gap: prefixed with '+' when the trip landed after its promise, '-' when it closed early. */
export function formatSignedDuration(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const text = formatDurationMinutes(value);
    return value > 0 ? `+${text}` : text;
}

/** "1 stop" / "4 stops" — counts render next to a noun throughout the grids. */
export function plural(count: number | null | undefined, noun: string): string {
    if (count === null || count === undefined || !Number.isFinite(count)) return '—';
    return `${count.toLocaleString('en-PH')} ${count === 1 ? noun : `${noun}s`}`;
}

/** Distribution of arrival errors, used by the ETA chart and the PDF methodology block. */
export function buildEtaBuckets(
    trips: Array<{ arrivalState: ArrivalState; etaErrorMinutes: number | null }>,
    toleranceMinutes: number
): EtaBucketRow[] {
    const scored = trips.filter((t) => t.etaErrorMinutes !== null);
    const buckets: EtaBucketRow[] = [
        { label: `Early > ${toleranceMinutes} min`, trips: 0 },
        { label: 'Within window', trips: 0 },
        { label: 'Up to 1 h late', trips: 0 },
        { label: '1–6 h late', trips: 0 },
        { label: '6–24 h late', trips: 0 },
        { label: 'Over 24 h late', trips: 0 },
    ];
    for (const trip of scored) {
        const err = trip.etaErrorMinutes as number;
        if (err < -toleranceMinutes) buckets[0].trips += 1;
        else if (err <= toleranceMinutes) buckets[1].trips += 1;
        else if (err <= 60) buckets[2].trips += 1;
        else if (err <= 360) buckets[3].trips += 1;
        else if (err <= 1440) buckets[4].trips += 1;
        else buckets[5].trips += 1;
    }
    return buckets;
}

/**
 * Default date window = the current calendar month.
 * WHY: the report opens on "this month" so the draft filter matches what people ask for most.
 * Local date parts are used on purpose. `toISOString()` converts to UTC, which in Manila (UTC+8)
 * would turn the 1st at local midnight into the last day of the previous month.
 */
function toLocalISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function getCurrentMonthRange(now: Date = new Date()): { startDate: string; endDate: string } {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // day 0 of next month = last day of this month
    return { startDate: toLocalISODate(start), endDate: toLocalISODate(end) };
}

/**
 * Single source of truth for the filter's starting and reset state.
 * Used by both the page's initial state and the Reset button so they can never drift apart.
 */
export function createDefaultFilter(): LogisticsReportFilter {
    return {
        ...getCurrentMonthRange(),
        // Use the module's own standard window so a fresh load and Reset agree with the
        // methodology text and TOLERANCE_OPTIONS ("1 hour (standard)"). Earlier draft hard-coded 15.
        toleranceMinutes: DEFAULT_ON_TIME_TOLERANCE_MINUTES,
    };
}