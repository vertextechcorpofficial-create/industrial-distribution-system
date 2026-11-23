/**
 * TypeScript Definitions for Inventory Health Report Module
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements contracts for:
 * - Cylinder fleet categorization (usable available/full, empty, defective, customer-held, in-transit)
 * - Coverage days calculation and zero-demand "Unavailable" representation
 * - Approved service level safety stock recommendations and lead time variance
 * - Stockout probability forecast & deterministic risk bands
 * - Dead stock aging analysis and tied-up capital calculation
 * - Universal C-Suite AI Copilot multi-tier responses and HITL metadata
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

export type StockoutRiskBand =
    | 'CRITICAL'     // < 7 days coverage or 0 usable stock with active demand
    | 'ELEVATED'     // 7 to 14 days coverage
    | 'MODERATE'     // 15 to 30 days coverage
    | 'HEALTHY'      // 31 to 90 days coverage
    | 'EXCESS'       // > 90 days coverage (overstocked)
    | 'NO_DEMAND';   // ADS = 0 (dormant or new item, coverage unavailable)

export type AgingCategory =
    | 'ACTIVE'       // Activity < 30 days
    | 'SLOW_MOVER'   // 31 to 60 days
    | 'DORMANT'      // 61 to 90 days
    | 'DEAD_STOCK';  // > 90 days with zero consumption

export interface CylinderFleetBreakdown {
    usableAvailableQuantity: number; // AVAILABLE or FULL in GOOD condition at branch
    emptyQuantity: number;           // EMPTY at branch
    defectiveQuantity: number;       // DAMAGED, FOR_REPAIR, SCRAP, RETIRED
    customerHeldQuantity: number;    // WITH_CUSTOMER or customer_code is present
    inTransitQuantity: number;       // LOADED, RESERVED
    totalFleetQuantity: number;      // Total assets linked to this SKU
}

export interface CylinderConditionCount {
    good: number;
    forRepair: number;
    damaged: number;
    scrap: number;
}

export interface SkuHealthRow {
    productId: number;
    productCode: string;
    productName: string; // Description used as product name per ids-guide
    description: string;
    category: string;
    unitCost: number;
    unitPrice: number;
    maintainingQuantity: number;
    fleet: CylinderFleetBreakdown;
    conditionBreakdown: CylinderConditionCount;
    // Demand & Coverage metrics
    windowDays: number;
    totalDemand: number;
    averageDailyDemand: number; // ADS = totalDemand / windowDays
    coverageDays: number | null; // null when ADS = 0 (rendered as "Unavailable")
    // Safety Stock & Lead Time
    safetyStockRecommendation: number;
    safetyStockCalculationBasis: string;
    leadTimeDays: number;
    demandStandardDeviation: number;
    // Risk & Forecast
    stockoutProbabilityPercentage: number | null; // Statistical probability if model validated, otherwise null
    hasValidatedModel: boolean;
    riskBand: StockoutRiskBand;
    // Dead stock & Aging
    agingCategory: AgingCategory;
    daysSinceLastMovement: number | null;
    deadStockQuantity: number;
    tiedUpCapital: number;
}

export interface InventoryHealthFilter {
    startDate?: string;
    endDate?: string;
    branchId?: number | string;
    productId?: number | string;
    riskBand?: string;
}

export interface ReportingMetadata {
    selectedPeriod: string;
    sourceCutoff: string;
    calculationBasis: string;
    missingDataNotice: string;
}

export interface InventoryHealthExecutiveKPIs {
    totalSkusEvaluated: number;
    criticalStockoutSkusCount: number;
    elevatedRiskSkusCount: number;
    healthySkusCount: number;
    excessStockSkusCount: number;
    deadStockSkusCount: number;
    totalUsableFleet: number;
    totalEmptyFleet: number;
    totalCustomerHeld: number;
    totalDefectiveFleet: number;
    totalFleet: number;
    fleetUtilizationRate: number | null; // (customerHeld / totalFleet) * 100
    totalTiedUpCapital: number;
    dataFreshnessTimestamp: string;
    metadata: ReportingMetadata;
}

export interface InventoryHealthReportPayload {
    filter: InventoryHealthFilter;
    kpis: InventoryHealthExecutiveKPIs;
    skus: SkuHealthRow[];
    userTier: {
        tierLevel: number;
        tierSlug: AiTierSlug;
        tierName: string;
    };
}

export interface AIObservation {
    id: string;
    type?: 'fact' | 'hypothesis' | 'estimate';
    category?: string;
    finding: string;
    supportingEvidence?: string;
    impactLevel?: 'low' | 'medium' | 'high';
    recommendedAction?: string;
    suggestedOwner?: string;
    department?: string;
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
    // Tier 1: 2-4 Bullets
    keyHighlights?: string[];
    // Tier 2: Narrative + Risks & Actions
    detailedAnalysis?: string;
    keyExposures?: (string | AIObservation)[];
    strategicActions?: (string | AIObservation)[];
    // Tier 3: 4-Section C-Suite Report
    executiveReport?: ExecutiveReportSectionData;
    userQuery?: string;
    qaAnswer?: string;
    disclaimer: string;
    isFallback?: boolean;
    governance?: AiGovernanceMetadata;
}
