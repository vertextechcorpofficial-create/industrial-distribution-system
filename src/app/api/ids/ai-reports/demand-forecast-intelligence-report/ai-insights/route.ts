/**
 * Gemini AI Insights API Route for Demand Forecast Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Routing through Centralized Core AI Layer (@/lib/ai) via runCoreAiAnalysis
 * - Dual-pass GDPR sanitization (PII scrubbing + data minimization)
 * - Executive 4-Section C-Suite parsing and structured Interactive Q&A
 * - Rule-based zero-crash deterministic fallback guarantee

 */

import { NextRequest, NextResponse } from 'next/server';
import { runCoreAiAnalysis, parseJsonSafe, redactPiiFromString, TierPolicy, GlobalAiTierSlug } from '@/lib/ai';
import {
    AiTierSlug,
    ProductDemandRow,
    DemandForecastKPIs,
    DemandAiInsightResponse,
    ExecutivePillar,
    AIObservation,
    ExecutiveReportSectionData,
    ChatMessage,
} from '@/modules/industrial-distribution-system/ai-reports/demand-forecast-intelligence-report/types';
import {
    getDomainSystemInstructionForTier,
    constructAnalysisPrompt,
} from '@/modules/industrial-distribution-system/ai-reports/demand-forecast-intelligence-report/services/geminiPrompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DemandAiInsightsRequestBody {
    kpis: DemandForecastKPIs;
    products: ProductDemandRow[];
    tierSlug?: AiTierSlug;
    userQuery?: string;
    chatHistory?: ChatMessage[];
}

/**
 * Deterministic offline fallback engine
 * Produces accurate C-suite findings directly from SQL metrics during outages
 */
function runDeterministicFallback(
    payload: {
        kpis: DemandForecastKPIs;
        products: ProductDemandRow[];
        userQuery?: string;
        chatHistory?: ChatMessage[];
    },
    tier: TierPolicy
): DemandAiInsightResponse {
    const { kpis, products, userQuery } = payload;

    // Sort products by demand descending
    const sortedByDemand = [...products].sort((a, b) => b.totalDemandQty - a.totalDemandQty);

    // Identify critical stockout products (runway < 7 days or 0 stock with demand)
    const criticalStockouts = [...products]
        .filter((p) => p.runwayStatus === 'CRITICAL_STOCKOUT')
        .sort((a, b) => a.daysOfSupply - b.daysOfSupply);

    // Identify undersupplied products (coverage < 80% with demand > 0)
    const undersuppliedProducts = [...products]
        .filter((p) => p.coverageStatus === 'UNDERSUPPLIED')
        .sort((a, b) => (a.replenishmentCoverage ?? 0) - (b.replenishmentCoverage ?? 0));

    // Identify oversupplied products (coverage > 150%)
    const oversuppliedProducts = [...products]
        .filter((p) => p.coverageStatus === 'OVERSUPPLIED')
        .sort((a, b) => (b.replenishmentCoverage ?? 0) - (a.replenishmentCoverage ?? 0));

    const topDemanded = sortedByDemand[0];
    const topStockout = criticalStockouts[0] || undersuppliedProducts[0];
    const topUndersupplied = topStockout;
    const topOversupplied = oversuppliedProducts[0];

    const covStr = kpis.avgReplenishmentCoverage !== null ? `${kpis.avgReplenishmentCoverage.toFixed(1)}%` : 'N/A';
    const tierSlug = tier.slug as AiTierSlug;

    // Ultra-concise 1-2 sentence executive summary
    const summary = `Demand across ${kpis.totalProductsEvaluated} serialized products totals ${kpis.totalDemandQty.toLocaleString()} units with a 30-day projected forecast of ${kpis.projectedTotalForecast30Day.toLocaleString()} units. Current usable full stock stands at ${kpis.totalStockOnHand.toLocaleString()} cylinders, with ${kpis.criticalStockoutCount} SKU(s) flagged at critical stockout risk (<7 days supply) requiring ${kpis.recommendedReplenishmentTotal.toLocaleString()} units of replenishment.`;

    // 1. Tier 1: Basic Highlights (2-4 Bullets)
    const keyHighlights: string[] = [
        `Historical sales demand totals ${kpis.totalDemandQty.toLocaleString()} units, generating a 30-day projected demand forecast of ${kpis.projectedTotalForecast30Day.toLocaleString()} units.`,
        `Current usable full stock stands at ${kpis.totalStockOnHand.toLocaleString()} cylinders with ${kpis.criticalStockoutCount} product line(s) facing critical stockout risk (<7 days runway).`,
        topStockout
            ? `Critical stockout risk on "${topStockout.productName}" with only ${topStockout.daysOfSupply} days of supply runway (On-hand: ${topStockout.stockOnHandFull} full units; recommended reorder: +${topStockout.suggestedReplenishment} units).`
            : `Inventory runway remains balanced across evaluated industrial catalog items.`,
        topDemanded
            ? `Highest demand volume is driven by "${topDemanded.productName}" with ${topDemanded.totalDemandQty.toLocaleString()} units demanded and a 30-day forecast of ${topDemanded.projected30DayDemand.toLocaleString()} units.`
            : `Fulfillment velocity remains distributed across evaluated industrial catalog items.`,
    ];

    // 2. Tier 2: Pro Narrative & Structured Risk Factors / Actions
    const detailedAnalysis = `Operational evaluation of ${kpis.totalProductsEvaluated} parent serialized products indicates enterprise demand of ${kpis.totalDemandQty.toLocaleString()} units, yielding a forward 30-day projected demand forecast of ${kpis.projectedTotalForecast30Day.toLocaleString()} units. Available warehouse inventory holds ${kpis.totalStockOnHand.toLocaleString()} usable full cylinders. Demand is heavily concentrated, with ${topDemanded ? `"${topDemanded.productName}" driving ${topDemanded.totalDemandQty.toLocaleString()} units across ${topDemanded.totalSoCount} sales orders (daily burn: ${topDemanded.dailyBurnRate.toFixed(2)}/day)` : 'lead items absorbing majority volume'}. Critical stockout risks affect ${kpis.criticalStockoutCount} product line(s), led by ${topStockout ? `"${topStockout.productName}" with ${topStockout.daysOfSupply} days of supply runway and an immediate reorder requirement of ${topStockout.suggestedReplenishment} units` : 'isolated SKUs'}. In parallel, ${kpis.overstockedCount} line(s) exhibit surplus or oversupply, tying up working capital.`;

    const keyExposures: AIObservation[] = [
        {
            id: 'exp-1',
            category: 'Stockout Runway Risk',
            finding: topStockout
                ? `Critical stockout risk on "${topStockout.productName}" (<7 days runway).`
                : 'Selected product lines show severe replenishment shortages.',
            supportingEvidence: topStockout
                ? `${topStockout.daysOfSupply} days of supply remaining at ${topStockout.dailyBurnRate.toFixed(2)} units/day burn rate. Usable full stock: ${topStockout.stockOnHandFull} units vs 30-day forecast of ${topStockout.projected30DayDemand} units.`
                : `${kpis.criticalStockoutCount} products breach the 7-day safe runway threshold.`,
            impactLevel: 'high',
        },
        {
            id: 'exp-2',
            category: 'Inventory Capital Trap',
            finding: topOversupplied
                ? `Excess replenishment receipts on "${topOversupplied.productName}".`
                : 'Oversupplied product lines creating potential working capital drag.',
            supportingEvidence: topOversupplied
                ? `${topOversupplied.totalReceivedQty.toLocaleString()} received vs ${topOversupplied.totalDemandQty.toLocaleString()} demanded (${topOversupplied.replenishmentCoverage !== null ? `${topOversupplied.replenishmentCoverage.toFixed(1)}%` : 'N/A'} coverage). Full stock: ${topOversupplied.stockOnHandFull} units.`
                : `${kpis.overstockedCount} lines exceed 150% demand-to-receipt ratio.`,
            impactLevel: 'medium',
        },
    ];

    const strategicActions: AIObservation[] = [
        {
            id: 'act-1',
            recommendedAction: `Expedite purchase order replenishment and production runs for ${topStockout ? `"${topStockout.productName}" (+${topStockout.suggestedReplenishment} units)` : 'all critical stockout lines'} to prevent fulfillment disruptions.`,
            finding: `Fulfillment demand outstrips available stock and receiving velocity by significant margins.`,
            suggestedOwner: 'Procurement & Inventory Planning Lead',
            department: 'Supply Chain Operations',
        },
        {
            id: 'act-2',
            recommendedAction: `Rebalance procurement schedules for surplus SKUs ${topOversupplied ? `like "${topOversupplied.productName}"` : ''} to optimize warehouse storage and free working capital.`,
            finding: `Receipt volume exceeds sales demand, creating excess stock accumulation.`,
            suggestedOwner: 'Warehouse & Logistics Manager',
            department: 'Inventory Management',
        },
    ];

    // 3. Tier 3: 4-Section Universal Executive Report
    const executiveReport: ExecutiveReportSectionData = {
        reportTitle: 'Demand Forecast & Inventory Alignment Executive Report',
        preparedBy: 'AI Demand Planning Analyst',
        focus: 'Demand Velocity, Replenishment Coverage, Stock Alignment, and Inventory Health',
        executiveSummary: summary,
        metricsTable: [
            {
                category: 'Total Demand Volume',
                actual: `${kpis.totalDemandQty.toLocaleString()} units`,
                target: 'Full Fulfillment',
                status: kpis.totalDemandQty > 0 ? 'Favorable' : 'Needs Review',
            },
            {
                category: 'Avg Replenishment Coverage',
                actual: covStr,
                target: '≥ 80.0% Benchmark',
                status: (kpis.avgReplenishmentCoverage ?? 0) >= 80 ? 'Adequate' : 'Undersupplied Risk',
            },
            {
                category: 'Undersupplied Product Lines',
                actual: `${kpis.understockedCount} Lines`,
                target: '0 Undersupplied',
                status: kpis.understockedCount === 0 ? 'Stable' : 'Critical',
            },
            {
                category: 'Total Stock On-Hand',
                actual: `${kpis.totalStockOnHand.toLocaleString()} units`,
                target: 'Safety Buffer Target',
                status: kpis.totalStockOnHand >= kpis.totalDemandQty ? 'Healthy' : 'Elevated Risk',
            },
        ],
        bottleneckFindings: {
            highEfficiency: [
                `Active demand evaluated across ${kpis.totalProductsEvaluated} parent serialized products with verifiable sales order activity.`,
                `${products.filter((p) => p.coverageStatus === 'BALANCED').length} product lines maintain balanced demand-to-replenishment coverage between 80% and 150%.`,
            ],
            primaryBottlenecks: [
                `Fulfillment vulnerability concentrated in ${kpis.understockedCount} undersupplied line(s)${topUndersupplied ? `, led by "${topUndersupplied.productName}" with only ${topUndersupplied.replenishmentCoverage !== null ? `${topUndersupplied.replenishmentCoverage.toFixed(1)}%` : '0%'} coverage` : ''}.`,
                `Fulfillment backlog: ${products.reduce((acc, p) => acc + (p.totalDemandQty - p.servedQty), 0).toLocaleString()} demanded units remain unserved across active orders.`,
            ],
            criticalDelays: [
                topUndersupplied
                    ? `Severe stockout exposure on "${topUndersupplied.productName}" with ${topUndersupplied.totalDemandQty.toLocaleString()} units ordered but only ${topUndersupplied.stockOnHandTotal} available on-hand.`
                    : 'Stockout risks present in high-demand industrial categories.',
            ],
        },
        keyTakeaways: [
            `Enterprise replenishment coverage stands at ${covStr}, constrained by ${kpis.understockedCount} critical product line(s) below safety stock thresholds.`,
            `Total on-hand stock of ${kpis.totalStockOnHand.toLocaleString()} units requires systematic rebalancing from oversupplied to undersupplied categories.`,
        ],
        strategicRecommendations: [
            {
                title: 'Prioritize Expedited Replenishment for Undersupplied Lines',
                description: `Direct the Procurement Planning Lead to issue emergency purchase orders and expedite delivery for lines with coverage below 80%.`,
                owner: 'Chief Supply Chain Officer',
            },
            {
                title: 'Freeze Purchase Orders for Severely Oversupplied SKUs',
                description: `Pause upcoming purchase batches on products exceeding 150% demand coverage until warehouse stock depletes to target safety buffers.`,
                owner: 'Inventory Control Director',
            },
        ],
    };

    // Backward-compatible 3 Pillars
    const executivePillars: ExecutivePillar[] = [
        {
            pillar: 'Demand Velocity & Order Intake',
            status: kpis.totalDemandQty > 0 ? 'STABLE' : 'MODERATE',
            findings: topDemanded
                ? `Demand is strongly concentrated on "${topDemanded.productName}", accounting for ${topDemanded.totalDemandQty.toLocaleString()} units across ${topDemanded.totalSoCount} sales orders.`
                : 'Order volume is distributed evenly across evaluated industrial lines.',
        },
        {
            pillar: 'Replenishment & Fulfillment Alignment',
            status: (kpis.avgReplenishmentCoverage ?? 0) < 80 ? 'CRITICAL' : 'MODERATE',
            findings: topUndersupplied
                ? `Fulfillment gap on "${topUndersupplied.productName}" (${topUndersupplied.replenishmentCoverage !== null ? `${topUndersupplied.replenishmentCoverage.toFixed(1)}%` : '0%'} coverage) represents immediate stockout risk.`
                : 'Replenishment rates align adequately with outgoing demand schedules.',
        },
        {
            pillar: 'Inventory Risk & Working Capital',
            status: kpis.understockedCount > 0 || kpis.overstockedCount > 0 ? 'ACTION_REQUIRED' : 'STABLE',
            findings: `${kpis.understockedCount} line(s) undersupplied vs ${kpis.overstockedCount} line(s) oversupplied indicates structural inventory imbalance requiring re-allocation.`,
        },
    ];

    let qaAnswer: string | undefined = undefined;
    if (userQuery) {
        const qLower = userQuery.toLowerCase();
        const primaryIssueProduct = topUndersupplied?.productName || 'undersupplied items';
        const primaryCoverage = topUndersupplied?.replenishmentCoverage !== null ? `${topUndersupplied?.replenishmentCoverage?.toFixed(1)}%` : '0%';

        if (qLower.includes('pass') || qLower.includes('credential') || qLower.includes('account')) {
            qaAnswer =
                "As an enterprise AI Demand Planning Analyst, I operate under strict read-only governance and have zero access to user accounts or authentication credentials. If you require password recovery, please contact your internal IT administrator.";
        } else if (qLower.includes('capabilit') || qLower.includes('what can you do') || qLower.includes('what do you do')) {
            qaAnswer =
                "I am your strategic AI Demand Planning Analyst. I specialize in evaluating product demand velocity, tracking replenishment coverage against sales orders, identifying stockout and oversupply risks, and providing actionable inventory rebalancing recommendations.";
        } else if (qLower.includes('repeat') || qLower.includes('same thing') || qLower.includes('why are you')) {
            qaAnswer =
                "My apologies for any repetition. Earlier responses established the portfolio demand baseline. I am ready to answer any specific question regarding particular products, branch fulfillment, or inventory coverage levels.";
        } else if (qLower.includes('hello') || qLower.includes('hi') || qLower.includes('hey') || qLower.includes('good morning') || qLower.includes('good afternoon')) {
            qaAnswer =
                "Hello! I am here to assist you with demand forecasting and inventory alignment analysis. Feel free to ask about any specific product, stockout exposures, or replenishment targets.";
        } else if (qLower.includes('undersuppl') || qLower.includes('shortage') || qLower.includes('stockout')) {
            qaAnswer =
                `We have **${kpis.understockedCount} undersupplied product line(s)** on record. The most critical exposure is **"${primaryIssueProduct}"** with only **${primaryCoverage} replenishment coverage** against **${topUndersupplied?.totalDemandQty.toLocaleString() ?? '0'} demanded units**. I recommend prioritizing an expedited replenishment purchase order immediately.`;
        } else if (qLower.includes('oversuppl') || qLower.includes('excess') || qLower.includes('overstock')) {
            qaAnswer =
                `We have **${kpis.overstockedCount} oversupplied product line(s)** exceeding 150% coverage. The largest excess is on **"${topOversupplied?.productName ?? 'primary oversupplied line'}"** with **${topOversupplied?.replenishmentCoverage !== null ? `${topOversupplied?.replenishmentCoverage?.toFixed(1)}%` : 'N/A'} coverage** and **${topOversupplied?.stockOnHandTotal ?? 0} units on-hand**. Pausing additional PO commitments is recommended.`;
        } else {
            qaAnswer =
                `Based on active sales and replenishment records, enterprise demand stands at **${kpis.totalDemandQty.toLocaleString()} units** with average coverage of **${covStr}**. The primary supply vulnerability is **"${primaryIssueProduct}"** at **${primaryCoverage} coverage**. Recommended action: review open PO schedules with Procurement Operations.`;
        }
    }

    return {
        tierSlug,
        tierName: tier.name,
        model: 'Rule-Based Deterministic Engine (Offline)',
        summary,
        keyHighlights: tierSlug === 'basic' ? keyHighlights : undefined,
        detailedAnalysis: tierSlug === 'pro' ? detailedAnalysis : undefined,
        keyExposures: tierSlug === 'pro' ? keyExposures : undefined,
        strategicActions: tierSlug === 'pro' ? strategicActions : undefined,
        executiveReport: tierSlug === 'executive' ? executiveReport : undefined,
        executivePillars: tierSlug === 'executive' ? executivePillars : undefined,
        userQuery,
        qaAnswer,
        isFallback: true,
        disclaimer: 'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
    };
}

export async function POST(req: NextRequest) {
    try {
        const body: DemandAiInsightsRequestBody = await req.json().catch(() => ({}));
        const { kpis, products, tierSlug = 'basic', userQuery, chatHistory } = body;

        if (!kpis || !Array.isArray(products)) {
            return NextResponse.json({ error: 'Invalid payload: kpis and products are required.' }, { status: 400 });
        }

        // Sanitize any user inquiry using PII redaction (GDPR Dual-Pass)
        const sanitizedUserQuery = userQuery ? redactPiiFromString(userQuery.trim()) : undefined;
        const isCustomQuery = Boolean(sanitizedUserQuery && tierSlug === 'executive');

        // Centralized Core AI Execution via runCoreAiAnalysis
        const coreResponse = await runCoreAiAnalysis<
            {
                kpis: DemandForecastKPIs;
                products: ProductDemandRow[];
                userQuery?: string;
                chatHistory?: ChatMessage[];
            },
            DemandAiInsightResponse
        >(
            {
                moduleName: 'demand-forecast-intelligence-report',
                tierSlug: tierSlug as GlobalAiTierSlug,
                payload: { kpis, products, userQuery: sanitizedUserQuery, chatHistory },
                domainSystemInstruction: getDomainSystemInstructionForTier(tierSlug, isCustomQuery),
                buildPrompt: (data) =>
                    constructAnalysisPrompt(tierSlug, data.kpis, data.products, data.userQuery, data.chatHistory),
                fallbackEngine: (data, tier) => runDeterministicFallback(data, tier),
                parseResponse: (rawText: string) => {
                    if (isCustomQuery) {
                        return {
                            tierSlug,
                            tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                            model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                            summary: '',
                            keyExposures: [],
                            strategicActions: [],
                            userQuery: sanitizedUserQuery,
                            qaAnswer: rawText,
                            disclaimer:
                                'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
                        };
                    }

                    const parsedJson = parseJsonSafe<Partial<DemandAiInsightResponse>>(rawText);
                    if (parsedJson && (parsedJson.summary || parsedJson.executiveReport)) {
                        return {
                            tierSlug,
                            tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                            model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                            summary: parsedJson.summary || parsedJson.executiveReport?.executiveSummary || '',
                            keyHighlights: Array.isArray(parsedJson.keyHighlights)
                                ? parsedJson.keyHighlights.slice(0, 4)
                                : undefined,
                            detailedAnalysis: parsedJson.detailedAnalysis,
                            keyExposures: parsedJson.keyExposures,
                            strategicActions: parsedJson.strategicActions,
                            executiveReport: parsedJson.executiveReport,
                            executivePillars: Array.isArray(parsedJson.executivePillars)
                                ? (parsedJson.executivePillars as ExecutivePillar[])
                                : undefined,
                            disclaimer:
                                'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
                        };
                    }

                    // Fallback structured mapping if JSON parsing fails but text returned
                    return {
                        tierSlug,
                        tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                        model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                        summary: rawText.slice(0, 400),
                        keyExposures: [
                            `Evaluated ${kpis.totalProductsEvaluated} active serialized products.`,
                            `Enterprise demand recorded at ${kpis.totalDemandQty.toLocaleString()} units with coverage of ${kpis.avgReplenishmentCoverage !== null ? `${kpis.avgReplenishmentCoverage.toFixed(1)}%` : 'N/A'}.`,
                            `${kpis.understockedCount} product line(s) identified with critical undersupply risk.`,
                        ],
                        strategicActions: [
                            'Issue replenishment POs for flagged undersupplied SKUs.',
                            'Verify sales order backlogs against physical warehouse inventory.',
                            'Realign safety stock buffers before next monthly demand cycle.',
                        ],
                        disclaimer:
                            'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
                    };
                },
                sanitization: {
                    maxItemsCap: 30, // Data Minimization GDPR Art. 5
                    stripSensitiveKeys: true,
                    redactPii: true,
                },
            },
            tierSlug === 'executive' ? 3 : tierSlug === 'pro' ? 2 : 1
        );

        const responsePayload: DemandAiInsightResponse = {
            ...coreResponse.data,
            model: coreResponse.governance.modelUsed,
            isFallback: coreResponse.governance.isFallback,
            governance: coreResponse.governance,
        };

        return NextResponse.json(responsePayload);
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown AI generation error';
        console.error('[DemandForecast AI Route Error]:', errorMsg);
        return NextResponse.json({ error: 'Failed to process AI request', details: errorMsg }, { status: 500 });
    }
}
