/**
 * TypeScript Definitions for Warehouse Efficiency Intelligence Report Module
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements contracts for:
 * - Picking & packing productivity metrics (comparable units / labor hours)
 * - Dock bay utilization trends & turnaround intervals
 * - Space utilization & slotting inefficiency detection
 * - Labor productivity variance & bottleneck diagnosis
 * - Multi-tier AI Copilot (Basic, Pro, Executive) with deterministic offline fallback
 * - Report governance workflow statuses (Queued, Processing, Draft, Under Review, Approved, Published, Archived)
 */

import { AiGovernanceMetadata } from '@/lib/ai';

export type AiTierSlug = 'basic' | 'pro' | 'executive';

export interface AiTierInfo {
    id: number;
    slug: AiTierSlug;
    name: string;
    tierLevel: number;
    description: string;
}

export type UnitTypeCategory = 'CYLINDER' | 'PALLET' | 'EACH' | 'ALL';

export type ShiftType = 'ALL' | 'MORNING' | 'AFTERNOON' | 'NIGHT';

export type DateRangePreset = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';

export type BottleneckTag =
    | 'PICKING_STALL'
    | 'AUDIT_QUEUE'
    | 'DOCK_CONGESTION'
    | 'SPACE_CONSTRAINED'
    | 'SMOOTH_FLOW';

export type ReportLifecycleStatus =
    | 'Queued'
    | 'Processing'
    | 'Failed'
    | 'Draft'
    | 'Under Review'
    | 'Needs Revision'
    | 'Approved'
    | 'Published'
    | 'Archived';

export interface WarehouseEfficiencyFilter {
    datePreset?: DateRangePreset;
    startDate?: string;
    endDate?: string;
    branchId?: number | string;
    shift?: ShiftType;
    unitType?: UnitTypeCategory;
    bottleneck?: string;
}

export interface ReportingMetadata {
    selectedPeriod: string;
    sourceCutoff: string;
    calculationBasis: string;
    missingDataNotice: string;
}

export interface WarehouseEfficiencyRow {
    id: string; // e.g. branchId-shift-date
    warehouseId: number;
    warehouseName: string;
    warehouseCode: string;
    shift: string;
    date: string;
    // Productivity metrics
    completedUnits: number;
    cylindersCount: number;
    palletsCount: number;
    eachesCount: number;
    productiveLaborHours: number | null; // null when 0 recorded
    pickRate: number | null; // Completed units / productive labor hours
    packRate: number | null; // Audited units / productive labor hours
    pickRateDisplay: string;
    packRateDisplay: string;
    // Dock utilization
    dockOccupiedHours: number;
    dockAvailableHours: number;
    dockUtilizationRate: number | null; // Occupied / Available * 100
    dockUtilizationDisplay: string;
    // Space utilization
    totalCapacityUnits: number;
    occupiedCapacityUnits: number;
    spaceUtilizationRate: number | null; // Occupied / Capacity * 100
    spaceUtilizationDisplay: string;
    damagedOrQuarantineAssets: number;
    // Operational timings & bottleneck
    averageQueueTimeMins: number | null;
    bottleneck: BottleneckTag;
    bottleneckReason: string;
    // Supporting records link
    consolidatorCount: number;
    dispatchPlanCount: number;
    activePickersCount: number;
}

export interface WarehouseEfficiencyKPIs {
    totalCompletedUnits: number;
    totalCylindersPicked: number;
    totalPalletsPicked: number;
    totalEachesPicked: number;
    averagePickRate: number | null;
    averagePackRate: number | null;
    overallDockUtilizationRate: number | null;
    overallSpaceUtilizationRate: number | null;
    averageQueueTimeMinutes: number | null;
    totalActiveWarehouses: number;
    totalOperatingShifts: number;
    primaryIdentifiedBottleneck: BottleneckTag;
    dataFreshnessTimestamp: string;
    metadata: ReportingMetadata;
}

export interface WarehouseEfficiencyReportPayload {
    filter: WarehouseEfficiencyFilter;
    kpis: WarehouseEfficiencyKPIs;
    rows: WarehouseEfficiencyRow[];
    userTier: {
        tierLevel: number;
        tierSlug: AiTierSlug;
        tierName: string;
    };
    reportStatus?: ReportLifecycleStatus;
    reportNo?: string;
    version?: string;
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

export interface ExecutiveStrategicRecommendation {
    title: string;
    description: string;
    owner?: string;
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
    strategicRecommendations?: ExecutiveStrategicRecommendation[];
    governanceDisclaimer?: string;
}

export interface AiInsightResponse {
    summary: string;
    keyHighlights?: string[];
    detailedAnalysis?: string;
    keyExposures?: AIObservation[];
    strategicActions?: AIObservation[];
    executiveReport?: ExecutiveReportSectionData;
    qaAnswer?: string;
    userQuery?: string;
    isFallback?: boolean;
    metadata?: AiGovernanceMetadata;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}
