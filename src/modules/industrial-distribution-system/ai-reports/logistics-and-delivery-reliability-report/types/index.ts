/**
 * TypeScript contracts for the Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Scope notes (validated against live Directus data, Nov 2026):
 * - Origin scope is strictly branches.division_id = 1 AND branches.isActive = 1.
 * - Product scope is strictly products.parent_id IS NULL AND products.is_serialized = 1 AND products.isActive = 1.
 * - Trip distance, fuel allocations, delivery proofs and GPS logs are NOT captured for industrial
 *   branches, so they are reported as coverage counters instead of fabricated metrics.
 */

import { AiGovernanceMetadata } from '@/lib/ai';

export type AiTierSlug = 'basic' | 'pro' | 'executive';

export interface LogisticsReportFilter {
    startDate?: string;
    endDate?: string;
    branchId?: number | string;
    productId?: number | string;
    toleranceMinutes?: number;
}

/** Measurable verdict for a trip's arrival against its committed ETA. */
export type ArrivalState = 'ON_TIME' | 'LATE' | 'EARLY' | 'NO_COMMITMENT' | 'NO_ARRIVAL';

/** Which part of the journey produced the lateness. */
export type RootCauseCategory =
    | 'DEPOT_DISPATCH_DELAY'
    | 'ROAD_TRANSIT_DELAY'
    | 'DEPOT_AND_ROAD_DELAY'
    | 'ARRIVAL_RECORDING_GAP'
    | 'NOT_LATE'
    | 'NOT_MEASURABLE';

export interface TripStopRow {
    /** post_dispatch_invoices.id */
    stopId: number;
    sequence: number | null;
    invoiceId: number | null;
    invoiceNo: string | null;
    customerCode: string | null;
    customerName: string | null;
    /**
     * Stored post_dispatch_invoices.status, verbatim: Fulfilled / Not Fulfilled /
     * Fulfilled With Returns / Fulfilled With Concerns. Counts compare against these strings;
     * the screen renders the Clearance vocabulary through STOP_OUTCOME_LABELS instead.
     */
    outcome: string;
    remarks: string | null;
    /** Notice to Explain documents raised against this stop. */
    nteDocNos: string[];
    /** Delivery proof recorded for this stop, when the driver captured one. */
    proofOutcome: string | null;
    proofRemarks: string | null;
    proofPhotoFileId: string | null;
    proofRecipientName: string | null;
    /** Serialized industrial products invoiced on this stop. */
    products: Array<{ productId: number; description: string; quantity: number }>;
    deliveredUnits: number;
}

export interface TripExpenseRow {
    coaId: number | null;
    accountTitle: string | null;
    remarks: string | null;
    amount: number;
}

export interface TripSummaryRow {
    tripId: number;
    docNo: string;
    status: string;
    /** Philippine wall-clock date the dispatch was encoded (date_encoded, day part only). */
    date: string;
    depotBranchId: number | null;
    depotBranchName: string;
    driverId: number | null;
    driverName: string;
    vehicleId: number | null;
    vehiclePlate: string;
    vehicleName: string;
    vehicleType: string | null;
    /** Destination cluster served, resolved through dispatch_plan.cluster_id. */
    clusterName: string;
    plannedDeparture: string | null;
    actualDeparture: string | null;
    plannedArrival: string | null;
    actualArrival: string | null;
    /** True when an arrival time later than the departure time was actually committed. */
    hasArrivalCommitment: boolean;
    /** actual_arrival - estimated_arrival in minutes. Positive means late. */
    etaErrorMinutes: number | null;
    /** time_of_dispatch - estimated_time_of_dispatch in minutes. */
    departureLagMinutes: number | null;
    /** Portion of the ETA error accrued after the vehicle left the origin branch. */
    transitLagMinutes: number | null;
    arrivalState: ArrivalState;
    isOnTime: boolean | null;
    rootCauseCategory: RootCauseCategory;
    stopsCount: number;
    fulfilledStops: number;
    returnsStops: number;
    concernStops: number;
    unfulfilledStops: number;
    deliveredUnits: number;
    tripCost: number;
    approvedAmount: number;
    costPerDeliveredUnit: number | null;
    fuelLiters: number | null;
    hasFuelLog: boolean;
    hasProofs: boolean;
    hasGpsLogs: boolean;
    hasNte: boolean;
    gpsPointCount: number;
    remarks: string | null;
    stops: TripStopRow[];
    expenses: TripExpenseRow[];
}

export interface RoutePerformanceRow {
    routeKey: string;
    depotBranchId: number | null;
    depotBranchName: string;
    destinationCluster: string;
    totalTrips: number;
    measurableTrips: number;
    onTimeTrips: number;
    lateTrips: number;
    /** Arrived before the promised time. Scored as on time, but still a miss on the arrival clock. */
    earlyTrips: number;
    onTimeRatePercentage: number | null;
    meanAbsoluteErrorMinutes: number | null;
    medianEtaErrorMinutes: number | null;
    totalStops: number;
    totalDeliveredUnits: number;
    totalRouteCost: number;
    averageCostPerTrip: number | null;
    costPerDeliveredUnit: number | null;
}

export interface LateShipmentRootCauseRow {
    tripId: number;
    docNo: string;
    date: string;
    depotBranchName: string;
    driverName: string;
    vehiclePlate: string;
    clusterName: string;
    etaErrorMinutes: number;
    departureLagMinutes: number | null;
    transitLagMinutes: number | null;
    rootCauseCategory: RootCauseCategory;
    stopsCount: number;
    unfulfilledStops: number;
    returnsStops: number;
    remarksEvidence: string[];
    nteDocNos: string[];
    hasProofs: boolean;
    hasGpsLogs: boolean;
}

export interface FleetActivityRow {
    vehicleId: number | null;
    vehiclePlate: string;
    vehicleName: string;
    vehicleType: string | null;
    registeredHomeBranch: string | null;
    totalTrips: number;
    activeDays: number;
    totalStops: number;
    totalDeliveredUnits: number;
    unfulfilledStops: number;
    returnsStops: number;
    totalCost: number;
    costPerDeliveredUnit: number | null;
    averageStopsPerTrip: number | null;
    onTimeTrips: number;
    measurableTrips: number;
    onTimeRatePercentage: number | null;
    /** Vehicle master capacity, null when the fleet register has not been configured. */
    ratedWeightKg: number | null;
    ratedCbm: number | null;
    fuelTankLiters: number | null;
    totalFuelLiters: number | null;
}

export interface EtaBucketRow {
    label: string;
    trips: number;
}

export interface ReportExecutiveKPIs {
    totalTripsEvaluated: number;
    completedTripsCount: number;
    /** Trips that carry an arrival commitment later than their departure time. */
    measurableTripsCount: number;
    uncommittedTripsCount: number;
    missingArrivalCount: number;
    onTimeTripsCount: number;
    lateTripsCount: number;
    earlyTripsCount: number;
    /** Headline figure: measured over measurableTripsCount only. */
    onTimeSharePercentage: number | null;
    meanAbsoluteErrorMinutes: number | null;
    medianEtaErrorMinutes: number | null;
    depotLateDeparturesCount: number;
    roadLateArrivalsCount: number;
    totalStops: number;
    unfulfilledStopsCount: number;
    unfulfilledStopsPercentage: number | null;
    returnsStopsCount: number;
    totalDeliveredUnits: number;
    totalTripCost: number;
    averageCostPerDeliveredUnit: number | null;
    averageStopsPerTrip: number | null;
    /**
     * Evidence coverage. Proofs, GPS, fuel and header distance have no writer in this application — see
     * EVIDENCE_OUT_OF_SCOPE_NOTE — so the panel plots the two rows below plus NTE instead.
     */
    tripsWithFuelLogs: number;
    tripsWithProofs: number;
    tripsWithGpsLogs: number;
    tripsWithDistance: number;
    tripsWithNte: number;
    tripsWithRemarks: number;
    tripsWithBudgetLines: number;
    etaBuckets: EtaBucketRow[];
    toleranceMinutes: number;
    dataFreshnessTimestamp: string;
}

export interface LogisticsReportPayload {
    filter: LogisticsReportFilter;
    kpis: ReportExecutiveKPIs;
    trips: TripSummaryRow[];
    routes: RoutePerformanceRow[];
    lateShipments: LateShipmentRootCauseRow[];
    fleet: FleetActivityRow[];
    userTier: {
        tierLevel: number;
        tierSlug: AiTierSlug;
        tierName: string;
    };
}

export interface ExecutivePillar {
    pillar: string;
    status: 'CRITICAL' | 'MODERATE' | 'STABLE' | 'ACTION_REQUIRED';
    findings: string;
}

export interface AIObservation {
    id: string;
    category?: string;
    finding: string;
    supportingEvidence?: string;
    impactLevel?: 'low' | 'medium' | 'high';
    recommendedAction?: string;
    suggestedOwner?: string;
}

export interface ExecutiveReportSectionData {
    reportTitle: string;
    preparedBy: string;
    focus: string;
    executiveSummary: string;
    metricsTable: Array<{
        category: string;
        actual: string;
        target: string;
        status: string;
    }>;
    bottleneckFindings: {
        highEfficiency: string[];
        primaryBottlenecks: string[];
        criticalDelays: string[];
    };
    keyTakeaways: string[];
    strategicRecommendations: Array<{
        title: string;
        description: string;
        owner?: string;
    }>;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface AiInsightResponse {
    tierSlug: AiTierSlug;
    tierName: string;
    model: string;
    summary: string;
    keyHighlights?: string[];
    detailedAnalysis?: string;
    keyExposures?: (string | AIObservation)[];
    strategicActions?: (string | AIObservation)[];
    executiveReport?: ExecutiveReportSectionData;
    executivePillars?: ExecutivePillar[];
    userQuery?: string;
    qaAnswer?: string;
    disclaimer: string;
    isFallback?: boolean;
    governance?: AiGovernanceMetadata;
}
