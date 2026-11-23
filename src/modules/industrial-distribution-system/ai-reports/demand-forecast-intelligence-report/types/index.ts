/**
 * TypeScript definitions for Demand Forecast Intelligence Report Module
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
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

export interface DemandForecastFilter {
    startDate?: string;
    endDate?: string;
    branchId?: number | string;
    productId?: number | string;
}

/** Monthly demand bucket for sparkline trend charts */
export interface MonthlyDemandBucket {
    month: string;       // 'YYYY-MM'
    demandQty?: number;
    orderedQty?: number;
}

/** Daily forward projection item */
export interface ForwardDayProjection {
    date: string;                     // 'YYYY-MM-DD'
    dayIndex: number;                 // 1, 2, 3 ... 14
    dayLabel: string;                 // e.g. 'Thu, Nov 21'
    projectedDemand: number;          // units projected for that day
    endingStock: number;              // projected remaining full stock at end of day
    status: 'SAFE' | 'LOW' | 'STOCKOUT';
}

/** Per-product aggregated demand + stock row */
export interface ProductDemandRow {
    productId: number;
    productName: string;              // products.description || products.product_name
    branchId: number | null;          // null = cross-branch aggregate
    branchName: string | null;
    totalDemandQty: number;           // sum of ordered_quantity from non-cancelled SOs
    servedQty: number;                // sum of served_quantity from same SOs
    totalSoCount: number;             // count of distinct sales orders
    avgOrderQty: number | null;       // totalDemandQty / totalSoCount
    totalPurchasedQty: number;        // sum of purchase_order_products.ordered_quantity
    totalReceivedQty: number;         // sum of purchase_order_receiving.received_quantity
    stockOnHandFull: number;          // v_serial_onhand / cylinder_assets status = 'Full'
    stockOnHandEmpty?: number;        // status = 'Empty' (retained for backward compatibility if needed)
    stockOnHandTotal: number;         // usable full stock on hand
    replenishmentCoverage: number | null; // (totalReceivedQty / totalDemandQty) * 100
    // Forecasting metrics
    dailyBurnRate: number;            // totalDemandQty / periodDays (units per day)
    forecast7Day: number;             // dailyBurnRate * 7
    forecast14Day: number;            // dailyBurnRate * 14
    projected30DayDemand: number;     // dailyBurnRate * 30
    daysOfSupply: number;             // stockOnHandFull / dailyBurnRate (runway in days)
    suggestedReplenishment: number;   // Math.max(0, projected30DayDemand - stockOnHandFull)
    estimatedStockoutDate: string | null; // 'YYYY-MM-DD' or 'TODAY' or null if infinite
    stockoutDaysRemaining: number | null; // days until stockout (0 = today, null = no depletion)
    forwardDailySchedule: ForwardDayProjection[]; // Next 14 days forward schedule
    runwayStatus: 'CRITICAL_STOCKOUT' | 'LOW_RUNWAY' | 'BALANCED' | 'SURPLUS' | 'NO_DEMAND';
    demandTrend?: MonthlyDemandBucket[];   // month-bucketed demand for sparkline
    monthlyDemandTrend?: MonthlyDemandBucket[];
    coverageStatus: 'UNDERSUPPLIED' | 'BALANCED' | 'OVERSUPPLIED' | 'NO_DATA';
}

/** Executive KPI summary */
export interface DemandForecastKPIs {
    totalProductsEvaluated: number;
    totalDemandQty: number;
    totalStockOnHand: number;         // Total usable FULL stock on hand
    projected7DayDemandTotal: number; // Sum of 7-day forecast across all products
    projected14DayDemandTotal: number;// Sum of 14-day forecast across all products
    projectedTotalForecast30Day: number; // Sum of 30-day forecast across all products
    criticalStockoutCount: number;    // Products with <7 days runway or 0 stock with demand
    recommendedReplenishmentTotal: number; // Total units recommended to reorder
    avgReplenishmentCoverage: number | null;
    understockedCount: number;
    overstockedCount: number;
    dataFreshnessTimestamp: string;
}

/** Full report payload returned by the data API */
export interface DemandForecastReportPayload {
    filter: DemandForecastFilter;
    kpis: DemandForecastKPIs;
    products: ProductDemandRow[];
    userTier: {
        tierLevel: number;
        tierSlug: AiTierSlug;
        tierName: string;
    };
}

/** C-Suite pillar for executive tier */
export interface ExecutivePillar {
    pillar: string;
    status: 'CRITICAL' | 'MODERATE' | 'STABLE' | 'ACTION_REQUIRED';
    findings: string;
}

/** Structured observation/recommendation used in pro and executive tiers */
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

/** Executive 4-section report structure */
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

/** Multi-turn chat message */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

/** AI insight response */
export interface DemandAiInsightResponse {
    tierSlug: AiTierSlug;
    tierName: string;
    model: string;
    summary: string;
    // Tier 1: Basic bullets
    keyHighlights?: string[];
    // Tier 2: Pro narrative + risks + actions
    detailedAnalysis?: string;
    keyExposures?: (string | AIObservation)[];
    strategicActions?: (string | AIObservation)[];
    // Tier 3: 4-Section C-Suite + backward-compat pillars
    executiveReport?: ExecutiveReportSectionData;
    executivePillars?: ExecutivePillar[];
    userQuery?: string;
    qaAnswer?: string;
    disclaimer: string;
    isFallback?: boolean;
    governance?: AiGovernanceMetadata;
}
