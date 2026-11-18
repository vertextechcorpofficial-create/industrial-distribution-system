/**
 * Gemini AI Insights API Route for Supplier Performance
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Routing through Centralized Core AI Layer (@/lib/ai) via runCoreAiAnalysis
 * - Dual-pass GDPR sanitization (PII scrubbing + data minimization)
 * - Executive 3-Pillar C-Suite parsing and structured Interactive Q&A
 * - Rule-based zero-crash deterministic fallback guarantee
 */

import { NextRequest, NextResponse } from 'next/server';
import { runCoreAiAnalysis, parseJsonSafe, redactPiiFromString, TierPolicy, GlobalAiTierSlug } from '@/lib/ai';
import {
    AiTierSlug,
    SupplierSummaryRow,
    ReportExecutiveKPIs,
    AiInsightResponse,
    ExecutivePillar,
    AIObservation,
    ExecutiveReportSectionData,
    ChatMessage,
} from '@/modules/industrial-distribution-system/ai-reports/supplier-performance-ai-report/types';
import {
    getDomainSystemInstructionForTier,
    constructAnalysisPrompt,
} from '@/modules/industrial-distribution-system/ai-reports/supplier-performance-ai-report/services/geminiPrompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AiInsightsRequestBody {
    kpis: ReportExecutiveKPIs;
    suppliers: SupplierSummaryRow[];
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
        kpis: ReportExecutiveKPIs;
        suppliers: SupplierSummaryRow[];
        userQuery?: string;
        chatHistory?: ChatMessage[];
    },
    tier: TierPolicy
): AiInsightResponse {
    const { kpis, suppliers, userQuery } = payload;

    const bottomSuppliers = [...suppliers]
        .filter((s) => s.totalOrdersDue > 0 && s.otifPercentage !== null)
        .sort((a, b) => (a.otifPercentage ?? 0) - (b.otifPercentage ?? 0))
        .slice(0, 3);

    const highestRtsSupplier = [...suppliers]
        .filter((s) => s.rtsCount > 0)
        .sort((a, b) => b.rtsCount - a.rtsCount)[0];

    const highVarianceSuppliers = [...suppliers]
        .filter((s) => (s.averageCostVariancePercentage ?? 0) > 0)
        .sort((a, b) => (b.averageCostVariancePercentage ?? 0) - (a.averageCostVariancePercentage ?? 0));

    const otifStr = kpis.averageOtifRate !== null ? `${kpis.averageOtifRate}%` : 'N/A';
    const rejStr = kpis.averageRejectionRate !== null ? `${kpis.averageRejectionRate}%` : '0.00%';
    const tierSlug = tier.slug as AiTierSlug;

    // Ultra-concise 1-2 sentence executive summary
    const summary = `Enterprise supplier fulfillment is at ${otifStr} OTIF with an average rejection rate of ${rejStr} across ${kpis.totalSuppliersEvaluated} evaluated vendors. Strategic intervention is urgently required as ${kpis.highRiskVendorsCount} vendor(s) breach high-risk quality and delivery thresholds.`;

    // 1. Tier 1: Basic Highlights (2-4 Bullets)
    const keyHighlights: string[] = [
        `Enterprise delivery reliability currently stands at ${otifStr} OTIF compliance.`,
        `Quality inspection logged an average rejection rate of ${rejStr} across ${kpis.totalRtsReturns} total return batches.`,
        `${kpis.highRiskVendorsCount} out of ${kpis.totalSuppliersEvaluated} active vendors trigger elevated delivery or defect thresholds.`,
    ];

    // 2. Tier 2: Pro Narrative & Structured Risk Factors / Actions
    const detailedAnalysis = `Operational evaluation of ${kpis.totalSuppliersEvaluated} vendors shows fulfillment performance averaging ${otifStr}. Delivery friction is heavily concentrated among bottom-tier suppliers, led by ${bottomSuppliers[0]?.supplierName || 'primary vendors'} with only ${bottomSuppliers[0]?.otifPercentage ?? 0}% OTIF compliance across ${bottomSuppliers[0]?.totalOrdersDue ?? 0} scheduled orders. Concurrently, quality return events totaled ${kpis.totalRtsReturns} batches, with ${highestRtsSupplier?.supplierName || 'high-defect vendors'} accounting for ${highestRtsSupplier?.rtsCount ?? 0} RTS documents (${highestRtsSupplier?.rejectionRatePercentage ?? 0}% rejection rate). Reconciling split deliveries and pending return credit memos is essential to prevent margin leakage.`;

    const keyExposures: AIObservation[] = [
        {
            id: 'exp-1',
            category: 'Delivery Deficit',
            finding: `${bottomSuppliers[0]?.supplierName || 'Vendors'} achieved only ${bottomSuppliers[0]?.otifPercentage ?? 0}% OTIF compliance.`,
            supportingEvidence: `${bottomSuppliers[0]?.onTimeOrders ?? 0}/${bottomSuppliers[0]?.totalOrdersDue ?? 0} on-time orders with ${bottomSuppliers[0]?.splitDeliveryCount ?? 0} split receipts.`,
            impactLevel: 'high',
        },
        {
            id: 'exp-2',
            category: 'Quality Drag',
            finding: `${highestRtsSupplier?.supplierName || 'Vendors'} generated elevated return-to-supplier volume.`,
            supportingEvidence: `${highestRtsSupplier?.rtsCount ?? 0} RTS documents with a ${highestRtsSupplier?.rejectionRatePercentage ?? 0}% defect rate.`,
            impactLevel: 'high',
        },
    ];

    const strategicActions: AIObservation[] = [
        {
            id: 'act-1',
            recommendedAction: `Enforce a 10-business-day Corrective Action Plan (CAPA) on bottom-tier suppliers to resolve delivery bottlenecks.`,
            finding: `Near-zero OTIF fulfillment causing downstream warehouse inventory shortages.`,
            suggestedOwner: 'Vendor Quality Assurance',
            department: 'Procurement Quality',
        },
        {
            id: 'act-2',
            recommendedAction: `Hold pending finance disbursements for vendors with open, unallocated return-to-supplier credit memos.`,
            finding: `Unreconciled RTS defect quantities inflating total cost of ownership.`,
            suggestedOwner: 'Accounts Payable & SCM Lead',
            department: 'Supply Chain Operations',
        },
    ];

    // 3. Tier 3: 4-Section Universal Executive Report
    const executiveReport: ExecutiveReportSectionData = {
        reportTitle: 'Supplier Fulfillment & Procurement Quality Executive Report',
        preparedBy: 'AI Supplier Performance Analyst',
        focus: 'OTIF Fulfillment, RTS Defect Rates, Split Delivery Drag, and Margin Leakage',
        executiveSummary: summary,
        metricsTable: [
            {
                category: 'Enterprise OTIF Fulfillment',
                actual: otifStr,
                target: '95.0% Benchmark',
                status: (kpis.averageOtifRate ?? 0) >= 95 ? 'Favorable' : 'Needs Review',
            },
            {
                category: 'Average Rejection Rate',
                actual: rejStr,
                target: '≤ 2.0% Ceiling',
                status: (kpis.averageRejectionRate ?? 0) <= 2.0 ? 'Controlled' : 'Elevated Risk',
            },
            {
                category: 'High-Risk Vendor Concentration',
                actual: `${kpis.highRiskVendorsCount} Vendors`,
                target: '0 High-Risk',
                status: kpis.highRiskVendorsCount === 0 ? 'Stable' : 'Critical',
            },
            {
                category: 'Return-to-Supplier (RTS) Events',
                actual: `${kpis.totalRtsReturns} Batches`,
                target: '0 Defect Tolerance',
                status: kpis.totalRtsReturns === 0 ? 'Controlled' : 'Elevated Risk',
            },
        ],
        bottleneckFindings: {
            highEfficiency: [
                `Active vendor evaluation completed across ${kpis.totalSuppliersEvaluated} trading partners with operational purchase order records.`,
                `Unit pricing and purchase order cost compliance remain within standard tolerance for low-variance suppliers.`,
            ],
            primaryBottlenecks: [
                `Delivery velocity is suppressed by chronic fulfillment failures at ${bottomSuppliers[0]?.supplierName || 'key vendors'} (${bottomSuppliers[0]?.otifPercentage ?? 0}% OTIF).`,
                `Split shipment drag is prevalent among high-volume vendors, multiplying receiving docks administrative overhead.`,
            ],
            criticalDelays: [
                `${highestRtsSupplier?.supplierName || 'Primary defect vendor'} accounts for ${highestRtsSupplier?.rtsCount ?? 0} RTS return documents with a ${highestRtsSupplier?.rejectionRatePercentage ?? 0}% defect rate.`,
            ],
        },
        keyTakeaways: [
            `Enterprise OTIF stands at ${otifStr}, severely constrained by bottom-tier vendors with near-zero fulfillment reliability.`,
            `${kpis.highRiskVendorsCount} supplier(s) require immediate contractual and operational review to arrest margin and inventory leakage.`,
        ],
        strategicRecommendations: [
            {
                title: 'Mandate 10-Day CAPA on Bottom Performers',
                description: `Direct the Vendor Quality Assurance Lead to issue formal Notice to Cure letters requiring corrective action within 10 business days.`,
                owner: 'Vendor Quality Assurance Lead',
            },
            {
                title: 'Enforce Strict In-Full Delivery Terms',
                description: `Instruct the Procurement Operations Team to mandate complete shipments on single bills of lading to eliminate split delivery administrative friction.`,
                owner: 'Chief Procurement Officer',
            },
        ],
    };

    // Backward-compatible 3 Pillars
    const executivePillars: ExecutivePillar[] = [
        {
            pillar: 'Commercial & Margin Integrity',
            status: highVarianceSuppliers.length > 0 ? 'CRITICAL' : 'STABLE',
            findings: highVarianceSuppliers.length > 0
                ? `${highVarianceSuppliers[0].supplierName} shows a +${highVarianceSuppliers[0].averageCostVariancePercentage}% unit price variance across fulfilled batches.`
                : 'Unit purchase costs remain fully compliant with contracted purchase order commitments.',
        },
        {
            pillar: 'Supply Continuity & Logistics Friction',
            status: bottomSuppliers.some((s) => (s.otifPercentage || 0) < 60) ? 'CRITICAL' : 'MODERATE',
            findings: bottomSuppliers.length > 0
                ? `${bottomSuppliers[0].supplierName} delivered only ${bottomSuppliers[0].otifPercentage}% on-time orders across ${bottomSuppliers[0].totalOrdersDue} scheduled shipments.`
                : 'Fulfillment timelines remain stable across active delivery windows.',
        },
        {
            pillar: 'Vendor Governance & QBR Leverage',
            status: 'ACTION_REQUIRED',
            findings: highestRtsSupplier
                ? `Mandate a formal Corrective Action Plan for ${highestRtsSupplier.supplierName} citing ${highestRtsSupplier.rtsCount} return events and a ${highestRtsSupplier.rejectionRatePercentage}% rejection rate.`
                : 'Maintain standard quarterly reviews and routine lead-time monitoring.',
        },
    ];

    let qaAnswer: string | undefined = undefined;
    if (userQuery) {
        const qLower = userQuery.toLowerCase();
        const primaryIssueVendor = bottomSuppliers[0]?.supplierName || highestRtsSupplier?.supplierName || 'high-risk vendors';
        const primaryOtif = bottomSuppliers[0]?.otifPercentage ?? '0';
        const primaryRts = highestRtsSupplier?.rtsCount ?? 0;

        if (qLower.includes('pass') || qLower.includes('credential') || qLower.includes('account')) {
            qaAnswer =
                "As an enterprise AI Supply Chain Analyst, I operate under strict read-only governance and have zero access to user accounts or authentication credentials. If you are locked out or need password recovery, please contact your internal IT administrator.";
        } else if (qLower.includes('capabilit') || qLower.includes('what can you do') || qLower.includes('what do you do')) {
            qaAnswer =
                "I am your strategic AI Procurement & Supply Chain Analyst. I specialize in evaluating supplier delivery reliability (OTIF), diagnosing Return-To-Supplier (RTS) defect trends, analyzing purchase price cost variance, and recommending corrective action plans for high-risk vendors.";
        } else if (qLower.includes('repeat') || qLower.includes('same thing') || qLower.includes('why are you')) {
            qaAnswer =
                "My apologies for the repetition. Earlier responses summarized the portfolio risk baseline. I am here to address any specific question you have—whether about individual suppliers, delivery lead times, or return trends.";
        } else if (qLower.includes('hello') || qLower.includes('hi') || qLower.includes('hey') || qLower.includes('good morning') || qLower.includes('good afternoon')) {
            qaAnswer =
                "Hello! I'm here to assist you with your supplier performance and procurement analysis. Feel free to ask about any specific vendor, order bottlenecks, or defect records.";
        } else if (qLower.includes('tell me something') || qLower.includes('tell me')) {
            qaAnswer =
                `A key insight from your current evaluation is that delivery timeliness is the primary bottleneck across your active vendors, with OTIF averaging **${kpis.averageOtifRate !== null ? `${kpis.averageOtifRate}%` : 'N/A'}**. Let me know if you would like to explore specific vendor breakdowns or delivery schedules.`;
        } else if (qLower.includes('defect') || qLower.includes('rts') || qLower.includes('reject')) {
            qaAnswer =
                `We have **${kpis.totalRtsReturns} total RTS return documents** on record. The largest defect source is **${highestRtsSupplier?.supplierName || 'primary defect vendor'}** with **${primaryRts} return events** and a **${highestRtsSupplier?.rejectionRatePercentage ?? 0}%** rejection rate. I recommend initiating a supplier quality audit with Procurement QA.`;
        } else {
            qaAnswer =
                `Based on our active records, supplier performance is primarily constrained by **${primaryIssueVendor}** with an OTIF of **${primaryOtif}%** and **${primaryRts} return events**. To stabilize this, our recommended tactical step is a 10-day Corrective Action Plan (CAPA) led by Procurement Operations.`;
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
        const body: AiInsightsRequestBody = await req.json().catch(() => ({}));
        const { kpis, suppliers, tierSlug = 'basic', userQuery, chatHistory } = body;

        if (!kpis || !Array.isArray(suppliers)) {
            return NextResponse.json({ error: 'Invalid payload: kpis and suppliers are required.' }, { status: 400 });
        }

        // Sanitize any user inquiry using PII redaction (GDPR Dual-Pass)
        const sanitizedUserQuery = userQuery ? redactPiiFromString(userQuery.trim()) : undefined;
        const isCustomQuery = Boolean(sanitizedUserQuery && tierSlug === 'executive');

        // Centralized Core AI Execution
        const coreResponse = await runCoreAiAnalysis<
            {
                kpis: ReportExecutiveKPIs;
                suppliers: SupplierSummaryRow[];
                userQuery?: string;
                chatHistory?: ChatMessage[];
            },
            AiInsightResponse
        >(
            {
                moduleName: 'supplier-performance-ai-report',
                tierSlug: tierSlug as GlobalAiTierSlug,
                payload: { kpis, suppliers, userQuery: sanitizedUserQuery, chatHistory },
                domainSystemInstruction: getDomainSystemInstructionForTier(tierSlug, isCustomQuery),
                buildPrompt: (data) =>
                    constructAnalysisPrompt(tierSlug, data.kpis, data.suppliers, data.userQuery, data.chatHistory),
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

                    const parsedJson = parseJsonSafe<Partial<AiInsightResponse>>(rawText);
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
                            negotiationNotes: parsedJson.negotiationNotes,
                            disclaimer:
                                'AI recommendations are strictly advisory and require human review. They do not post ERP transactions or alter operating policies.',
                        };
                    }

                    // Fallback structured mapping
                    return {
                        tierSlug,
                        tierName: tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1),
                        model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                        summary: rawText.slice(0, 400),
                        keyExposures: [
                            `Evaluated ${kpis.totalSuppliersEvaluated} active vendor delivery cycles.`,
                            `Enterprise OTIF fulfillment recorded at ${kpis.averageOtifRate !== null ? `${kpis.averageOtifRate}%` : 'N/A'}.`,
                            `${kpis.highRiskVendorsCount} vendor(s) identified with high return or late delivery risk.`,
                        ],
                        strategicActions: [
                            'Review open PO lines with flagged high-risk suppliers.',
                            'Cross-check Return-to-Supplier item remarks with warehouse receiving.',
                            'Schedule vendor quarterly review before purchase agreement renewal.',
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

        const responsePayload: AiInsightResponse = {
            ...coreResponse.data,
            model: coreResponse.governance.modelUsed,
            isFallback: coreResponse.governance.isFallback,
            governance: coreResponse.governance,
        };

        return NextResponse.json(responsePayload);
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown AI generation error';
        console.error('[SupplierPerformance AI Route Error]:', errorMsg);
        return NextResponse.json({ error: 'Failed to process AI request', details: errorMsg }, { status: 500 });
    }
}
