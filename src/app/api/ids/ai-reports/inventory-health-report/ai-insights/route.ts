/**
 * Gemini AI Insights API Route for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Routing through Centralized Core AI Layer (@/lib/ai) via runCoreAiAnalysis
 * - Dual-pass GDPR sanitization (PII scrubbing + data minimization capped at 30 sample SKUs)
 * - Multi-tier synthesis (Basic, Pro, Executive) and Interactive Q&A
 
 */

import { NextRequest, NextResponse } from 'next/server';
import { runCoreAiAnalysis, parseJsonSafe, redactPiiFromString, TierPolicy, GlobalAiTierSlug } from '@/lib/ai';
import {
    AiTierSlug,
    SkuHealthRow,
    InventoryHealthExecutiveKPIs,
    AiInsightResponse,
    AIObservation,
    ExecutiveReportSectionData,
    ChatMessage,
} from '@/modules/industrial-distribution-system/ai-reports/inventory-health-report/types';
import {
    getDomainSystemInstructionForTier,
    constructAnalysisPrompt,
} from '@/modules/industrial-distribution-system/ai-reports/inventory-health-report/services/geminiPrompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AiInsightsRequestBody {
    kpis: InventoryHealthExecutiveKPIs;
    skus: SkuHealthRow[];
    tierSlug?: AiTierSlug;
    userQuery?: string;
    chatHistory?: ChatMessage[];
}

/**
 * Deterministic offline fallback engine
 * Produces accurate C-suite inventory health findings directly from calculated metrics during outages
 */
function runDeterministicFallback(
    payload: {
        kpis: InventoryHealthExecutiveKPIs;
        skus: SkuHealthRow[];
        userQuery?: string;
        chatHistory?: ChatMessage[];
    },
    tier: TierPolicy
): AiInsightResponse {
    const { kpis, skus, userQuery } = payload;

    const criticalSkus = [...skus]
        .filter((s) => s.riskBand === 'CRITICAL' || s.riskBand === 'ELEVATED')
        .sort((a, b) => (a.coverageDays ?? 999) - (b.coverageDays ?? 999))
        .slice(0, 3);

    const deadStockSkus = [...skus]
        .filter((s) => s.agingCategory === 'DEAD_STOCK' && s.fleet.usableAvailableQuantity > 0)
        .sort((a, b) => b.tiedUpCapital - a.tiedUpCapital)
        .slice(0, 3);

    const excessSkus = [...skus]
        .filter((s) => s.riskBand === 'EXCESS')
        .sort((a, b) => (b.coverageDays ?? 0) - (a.coverageDays ?? 0))
        .slice(0, 3);

    const tierSlug = tier.slug as AiTierSlug;
    const tiedUpCapitalStr = `PHP ${kpis.totalTiedUpCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const utilStr = kpis.fleetUtilizationRate !== null ? `${kpis.fleetUtilizationRate}%` : 'N/A';

    // 1-2 sentence executive summary
    const summary = `Enterprise cylinder fleet evaluation reveals ${kpis.criticalStockoutSkusCount} critical SKU(s) breaching replenishment thresholds, while ${kpis.deadStockSkusCount} dead stock SKU(s) immobilize ${tiedUpCapitalStr} in tied-up capital. Immediate filling prioritization and idle cylinder recovery are required to balance customer demand with branch stock buffers.`;

    // Tier 1: Basic Highlights (2-4 bullets)
    const keyHighlights: string[] = [
        `Fleet utilization currently stands at ${utilStr} across ${kpis.totalFleet} total registered cylinder assets.`,
        `${kpis.criticalStockoutSkusCount} parent SKU(s) face stockout vulnerability with coverage under 7 days or zero usable inventory.`,
        `${kpis.totalDefectiveFleet} cylinder(s) are currently sidelined in damaged or scrap condition, representing a repair recovery opportunity.`,
        `Dead stock inventory accounts for ${tiedUpCapitalStr} in immobilized working capital across ${kpis.deadStockSkusCount} dormant SKU(s).`,
    ];

    // Tier 2: Pro Narrative & Risk Exposures / Actions
    const detailedAnalysis = `Operational evaluation of ${kpis.totalSkusEvaluated} parent serialized SKUs shows usable warehouse stock at ${kpis.totalUsableFleet} cylinders against a circulating fleet of ${kpis.totalFleet} assets. Immediate stockout vulnerability is concentrated in ${criticalSkus[0]?.productName || 'primary gases'} with ${criticalSkus[0]?.coverageDays !== null ? `${criticalSkus[0]?.coverageDays} days` : '0 days'} of remaining coverage. Conversely, fleet stagnation persists in ${kpis.deadStockSkusCount} dormant products where ${kpis.totalEmptyFleet} empty cylinders and stagnant assets create working capital drag. Enforcing systematic cylinder re-qualification and customer retrieval cycles is imperative to prevent delivery stockouts.`;

    const keyExposures: AIObservation[] = [
        {
            id: 'exp-1',
            category: 'Stockout Vulnerability',
            finding: `${criticalSkus[0]?.productName || 'Critical SKU'} is operating beneath approved safety stock limits.`,
            supportingEvidence: `Usable stock = ${criticalSkus[0]?.fleet.usableAvailableQuantity ?? 0}, ADS = ${criticalSkus[0]?.averageDailyDemand ?? 0}, Coverage = ${criticalSkus[0]?.coverageDays !== null ? `${criticalSkus[0]?.coverageDays} days` : 'Unavailable'}. Recommended safety target is ${criticalSkus[0]?.safetyStockRecommendation ?? 0}.`,
            impactLevel: 'high',
        },
        {
            id: 'exp-2',
            category: 'Dead Stock Capital Drag',
            finding: `${deadStockSkus[0]?.productName || 'Dormant SKU'} has zero consumption in the evaluation period with unredeemed stock.`,
            supportingEvidence: `Idle stock = ${deadStockSkus[0]?.fleet.usableAvailableQuantity ?? 0} cylinders representing PHP ${(deadStockSkus[0]?.tiedUpCapital ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} tied-up capital.`,
            impactLevel: 'medium',
        },
    ];

    const strategicActions: AIObservation[] = [
        {
            id: 'act-1',
            recommendedAction: `Expedite bulk filling orders and prioritize decanting for critical stockout parent SKUs.`,
            finding: `Stockout risk bands indicate replenishment buffer depletion below 7-day operational safety thresholds.`,
            suggestedOwner: 'Production & Decanting Operations',
            department: 'Supply Chain Operations',
        },
        {
            id: 'act-2',
            recommendedAction: `Initiate a 14-day field audit and retrieval campaign for customer-held cylinders exceeding 60-day turnover.`,
            finding: `Customer-held cylinders constitute the majority of non-usable fleet, starving warehouse refill pipelines.`,
            suggestedOwner: 'Logistics Fleet Dispatcher',
            department: 'Customer Logistics',
        },
    ];

    // Tier 3: Universal Executive Report
    const executiveReport: ExecutiveReportSectionData = {
        reportTitle: 'Industrial Inventory Health & Fleet Optimization Executive Report',
        preparedBy: 'AI Inventory Health & Supply Chain Analyst',
        focus: 'Stockout Risk Forecast, Fleet Utilization, Safety Stock Variance, and Dead Stock Recovery',
        executiveSummary: summary,
        metricsTable: [
            {
                category: 'Critical Stockout Exposure',
                actual: `${kpis.criticalStockoutSkusCount} SKUs`,
                target: '0 Critical SKUs',
                status: kpis.criticalStockoutSkusCount === 0 ? 'Favorable' : 'Critical',
            },
            {
                category: 'Fleet Utilization Rate',
                actual: utilStr,
                target: '≥ 65.0% Benchmark',
                status: (kpis.fleetUtilizationRate ?? 0) >= 65 ? 'Healthy' : 'Needs Review',
            },
            {
                category: 'Dead Stock Capital Drag',
                actual: tiedUpCapitalStr,
                target: 'PHP 0.00',
                status: kpis.totalTiedUpCapital === 0 ? 'Controlled' : 'Elevated Risk',
            },
            {
                category: 'Defective Fleet Share',
                actual: `${kpis.totalDefectiveFleet} Cylinders`,
                target: '≤ 5.0% Fleet Share',
                status: kpis.totalFleet > 0 && (kpis.totalDefectiveFleet / kpis.totalFleet) <= 0.05 ? 'Controlled' : 'Elevated',
            },
        ],
        bottleneckFindings: {
            highEfficiency: [
                `${kpis.healthySkusCount} SKU(s) operate within healthy 15-to-90 day inventory coverage corridors.`,
                `${kpis.totalUsableFleet} full cylinders are certified ready for immediate customer dispatch.`,
            ],
            primaryBottlenecks: [
                `${kpis.criticalStockoutSkusCount} SKU(s) breach safety buffers, led by ${criticalSkus[0]?.productName || '-'}.`,
                `${kpis.totalEmptyFleet} empty cylinders accumulate at distribution branches awaiting decanting/filling.`,
            ],
            criticalDelays: [
                `${kpis.totalCustomerHeld} cylinders remain deployed at customer locations, constraining fleet circulation.`,
                `${kpis.deadStockSkusCount} product lines exhibit dormancy with zero sales demand across the evaluation period.`,
            ],
        },
        keyTakeaways: [
            `Prioritize filling production for ${criticalSkus.map((s) => s.productName).join(', ') || 'at-risk SKUs'} to avert stockouts.`,
            `Redistribute ${excessSkus[0]?.productName || 'overstocked items'} to regional satellite branches to normalize coverage.`,
            `Repurpose or requalify ${deadStockSkus[0]?.productName || 'dormant cylinder types'} to recover immobilized working capital.`,
        ],
        strategicRecommendations: [
            {
                title: 'Expedited Filling Buffer Rebalancing',
                description: 'Issue immediate production work orders for critical SKUs with less than 7 days of stock remaining.',
                owner: 'Decanting Operations Lead',
            },
            {
                title: 'Customer Cylinder Retrieval Sweep',
                description: 'Coordinate route logistics to reclaim stagnant customer cylinders and replenish empty warehouse stock.',
                owner: 'Distribution Logistics Manager',
            },
            {
                title: 'Damaged Cylinder Maintenance Campaign',
                description: 'Contract third-party hydro-testing and re-valving to return defective assets to active usable status.',
                owner: 'Quality Assurance Supervisor',
            },
        ],
    };

    // Handle interactive custom query fallback
    let qaAnswer: string | undefined = undefined;
    if (userQuery) {
        qaAnswer = `Regarding your inquiry: "${userQuery}"\n\nBased on deterministic evaluation of the current inventory dataset, there are **${kpis.criticalStockoutSkusCount} SKU(s)** at critical stockout risk, with **${kpis.totalUsableFleet} usable cylinders** on hand across all evaluated branches. Total dead stock capital stands at **${tiedUpCapitalStr}**. To optimize inventory, immediate focus should be placed on filling production for low-coverage SKUs and accelerating cylinder turnaround from customer locations.`;
    }

    return {
        tierSlug,
        tierName: tier.name,
        model: 'Rule-Based Deterministic Engine (Offline Fallback)',
        summary,
        keyHighlights,
        detailedAnalysis: tierSlug !== 'basic' ? detailedAnalysis : undefined,
        keyExposures: tierSlug !== 'basic' ? keyExposures : undefined,
        strategicActions: tierSlug !== 'basic' ? strategicActions : undefined,
        executiveReport: tierSlug === 'executive' ? executiveReport : undefined,
        userQuery,
        qaAnswer,
        disclaimer: 'Human review required before executing inventory or replenishment transactions.',
        isFallback: true,
        governance: {
            isAdvisoryOnly: true,
            requiresHumanReview: true,
            disclaimer: 'Human review required before executing inventory transactions.',
            modelUsed: 'Deterministic Fallback Engine',
            isFallback: true,
            generatedAt: new Date().toISOString(),
        },
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => ({}))) as AiInsightsRequestBody;
        const { kpis, skus, userQuery, chatHistory } = body;

        if (!kpis || !Array.isArray(skus)) {
            return NextResponse.json(
                { error: 'Invalid payload: kpis and skus are required.' },
                { status: 400 }
            );
        }

        const tierSlug: GlobalAiTierSlug = body.tierSlug && ['basic', 'pro', 'executive'].includes(body.tierSlug)
            ? (body.tierSlug as GlobalAiTierSlug)
            : 'basic';

        const isCustomQuery = Boolean(userQuery && userQuery.trim().length > 0);

        // Execute centralized AI analysis via @/lib/ai
        const response = await runCoreAiAnalysis<
            {
                kpis: InventoryHealthExecutiveKPIs;
                skus: SkuHealthRow[];
                userQuery?: string;
                chatHistory?: ChatMessage[];
            },
            AiInsightResponse
        >({
            moduleName: 'inventory-health-report',
            tierSlug,
            payload: {
                kpis,
                skus,
                userQuery: userQuery ? redactPiiFromString(userQuery) : undefined,
                chatHistory: chatHistory?.map((msg) => ({
                    ...msg,
                    content: redactPiiFromString(msg.content),
                })),
            },
            domainSystemInstruction: getDomainSystemInstructionForTier(tierSlug, isCustomQuery),
            buildPrompt: (sanitizedData) =>
                constructAnalysisPrompt(
                    sanitizedData.kpis,
                    sanitizedData.skus,
                    tierSlug,
                    sanitizedData.userQuery,
                    sanitizedData.chatHistory
                ),
            sanitization: {
                stripSensitiveKeys: true,
                redactPii: true,
                maxItemsCap: 30, // Data minimization: cap sample rows at 30
            },
            parseResponse: (rawText: string) => {
                if (isCustomQuery) {
                    return {
                        tierSlug,
                        tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                        model: 'gemini-2.5-flash',
                        summary: '',
                        userQuery,
                        qaAnswer: rawText.trim(),
                        disclaimer: 'uman review required.',
                        isFallback: false,
                    };
                }

                const parsed = parseJsonSafe<Record<string, unknown>>(rawText);
                if (!parsed) return null;

                return {
                    tierSlug,
                    tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                    model: 'gemini-2.5-flash',
                    summary: String(parsed.summary || ''),
                    keyHighlights: Array.isArray(parsed.keyHighlights) ? (parsed.keyHighlights as string[]) : undefined,
                    detailedAnalysis: typeof parsed.detailedAnalysis === 'string' ? parsed.detailedAnalysis : undefined,
                    keyExposures: Array.isArray(parsed.keyExposures) ? (parsed.keyExposures as AIObservation[]) : undefined,
                    strategicActions: Array.isArray(parsed.strategicActions) ? (parsed.strategicActions as AIObservation[]) : undefined,
                    executiveReport: parsed.executiveReport ? (parsed.executiveReport as ExecutiveReportSectionData) : undefined,
                    disclaimer: 'Human review required before altering stock balances.',
                    isFallback: false,
                };
            },
            fallbackEngine: (sanitizedData, tierPolicy) =>
                runDeterministicFallback(sanitizedData, tierPolicy),
        });

        // Enrich with governance metadata
        const result: AiInsightResponse = {
            ...response.data,
            tierSlug,
            tierName: response.tier.name,
            model: response.governance.modelUsed,
            isFallback: response.governance.isFallback,
            governance: response.governance,
            disclaimer: response.governance.disclaimer,
        };

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error('[InventoryHealth - AI Insights] Error:', err);
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: 'AI processing failed', details: msg }, { status: 500 });
    }
}
