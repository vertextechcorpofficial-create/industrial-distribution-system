/**
 * Gemini AI Insights API Route for Warehouse Efficiency Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Routing through Centralized Core AI Layer (@/lib/ai) via runCoreAiAnalysis
 * - Dual-pass GDPR sanitization (PII scrubbing + data minimization capped at 30 sample rows)
 * - Strict Tier-gated capabilities:
 *   - Tier 1 (Basic): Summary + 2-4 keyHighlights bullets. No custom chat.
 *   - Tier 2 (Pro): Operational Overview + Detailed narrative + Risk Factors & Actions. No custom chat.
 *   - Tier 3 (Executive): 4-Section C-Suite Executive Briefing + Interactive AI Chatbot.
 * - Deterministic offline fallback engine for zero-failure reliability
 */

import { NextRequest, NextResponse } from 'next/server';
import { runCoreAiAnalysis, parseJsonSafe, redactPiiFromString, TierPolicy, GlobalAiTierSlug } from '@/lib/ai';
import {
    AiTierSlug,
    WarehouseEfficiencyRow,
    WarehouseEfficiencyKPIs,
    AiInsightResponse,
    AIObservation,
    ExecutiveReportSectionData,
    ChatMessage,
} from '@/modules/industrial-distribution-system/ai-reports/warehouse-efficiency-intelligence-report/types';
import {
    getDomainSystemInstructionForTier,
    constructAnalysisPrompt,
} from '@/modules/industrial-distribution-system/ai-reports/warehouse-efficiency-intelligence-report/services/geminiPrompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AiInsightsRequestBody {
    kpis: WarehouseEfficiencyKPIs;
    rows: WarehouseEfficiencyRow[];
    tierSlug?: AiTierSlug;
    userQuery?: string;
    chatHistory?: ChatMessage[];
}

function runDeterministicFallback(
    payload: {
        kpis: WarehouseEfficiencyKPIs;
        rows: WarehouseEfficiencyRow[];
        userQuery?: string;
        chatHistory?: ChatMessage[];
    },
    tier: TierPolicy
): AiInsightResponse {
    const { kpis, rows, userQuery } = payload;

    const dockCongested = rows.filter((r) => r.bottleneck === 'DOCK_CONGESTION');
    const spaceConstrained = rows.filter((r) => r.bottleneck === 'SPACE_CONSTRAINED');
    const pickingStalls = rows.filter((r) => r.bottleneck === 'PICKING_STALL');

    const pickRateStr = kpis.averagePickRate !== null ? `${kpis.averagePickRate} u/hr` : 'Unavailable';
    const dockStr = kpis.overallDockUtilizationRate !== null ? `${kpis.overallDockUtilizationRate}%` : 'Unavailable';
    const spaceStr = kpis.overallSpaceUtilizationRate !== null ? `${kpis.overallSpaceUtilizationRate}%` : 'Unavailable';

    const summary = userQuery
        ? `Regarding your operational query: "${userQuery}" — Enterprise warehouse metrics indicate an average pick rate of ${pickRateStr} with dock bay utilization at ${dockStr}. The primary identified constraint is ${kpis.primaryIdentifiedBottleneck.replace(/_/g, ' ')}. Prioritize staggered dispatch staging and rebalancing picking batches to streamline operations.`
        : `Enterprise warehouse performance analysis shows an average pick rate of ${pickRateStr} with overall dock utilization at ${dockStr} and space occupancy at ${spaceStr}. The primary operational constraint detected across facilities is ${kpis.primaryIdentifiedBottleneck.replace(/_/g, ' ')}.`;

    const keyHighlights: string[] = [
        `Average pick throughput stands at ${pickRateStr} across ${kpis.totalActiveWarehouses} active facility locations.`,
        `Dock utilization averages ${dockStr}, with ${dockCongested.length} location(s) currently experiencing staging congestion.`,
        `Storage capacity is utilized at ${spaceStr}, with ${spaceConstrained.length} location(s) reaching density limits.`,
    ];

    const tierSlug = tier.slug as AiTierSlug;
    if (tierSlug === 'basic') {
        return {
            summary,
            keyHighlights,
            isFallback: true,
        };
    }

    const keyExposures: AIObservation[] = [];
    if (dockCongested.length > 0) {
        keyExposures.push({
            id: 'exp-dock-1',
            category: 'Dock Congestion',
            finding: `Elevated loading turnaround delays observed at ${dockCongested[0].warehouseName}.`,
            supportingEvidence: `Dock utilization reached ${dockCongested[0].dockUtilizationDisplay} with average queue time of ${dockCongested[0].averageQueueTimeMins ?? 60} mins.`,
            impactLevel: 'high',
        });
    }
    if (pickingStalls.length > 0) {
        keyExposures.push({
            id: 'exp-pick-1',
            category: 'Picking Inefficiency',
            finding: `Picking throughput below operational targets at ${pickingStalls[0].warehouseName}.`,
            supportingEvidence: `Current pick rate measured at ${pickingStalls[0].pickRateDisplay}.`,
            impactLevel: 'medium',
        });
    }

    const strategicActions: AIObservation[] = [
        {
            id: 'act-1',
            category: 'Dock Scheduling',
            finding: 'Staggered dispatch staging windows needed to reduce loading bay queue peaks.',
            recommendedAction: 'Implement assigned 30-minute vehicle arrival slots aligned with pre-dispatch plan release.',
            suggestedOwner: 'Loading Dock Supervisor',
        },
        {
            id: 'act-2',
            category: 'Slotting Optimization',
            finding: 'High-velocity cylinder products stored in rear zones increase picker walking times.',
            recommendedAction: 'Re-slot top 20% fastest moving cylinder SKUs adjacent to primary consolidation bays.',
            suggestedOwner: 'Warehouse Operations Lead',
        },
    ];

    const executiveReport: ExecutiveReportSectionData = {
        reportTitle: 'Enterprise Warehouse Operational Intelligence Briefing',
        preparedBy: 'AI Warehouse Operations Analyst',
        focus: 'Fulfillment Throughput, Dock Turnaround, Space Optimization',
        executiveSummary: summary,
        metricsTable: [
            {
                category: 'Average Pick Throughput',
                actual: pickRateStr,
                target: '≥ 25.0 u/hr',
                status: (kpis.averagePickRate ?? 0) >= 25 ? 'Optimal' : 'Needs Review',
            },
            {
                category: 'Dock Bay Utilization',
                actual: dockStr,
                target: '≤ 80.0%',
                status: (kpis.overallDockUtilizationRate ?? 0) <= 80 ? 'Controlled' : 'Critical',
            },
            {
                category: 'Storage Occupancy',
                actual: spaceStr,
                target: '≤ 85.0%',
                status: (kpis.overallSpaceUtilizationRate ?? 0) <= 85 ? 'Controlled' : 'Needs Review',
            },
            {
                category: 'Average Staging Queue',
                actual: kpis.averageQueueTimeMinutes !== null ? `${kpis.averageQueueTimeMinutes} mins` : 'N/A',
                target: '≤ 30 mins',
                status: (kpis.averageQueueTimeMinutes ?? 0) <= 30 ? 'Controlled' : 'Needs Review',
            },
        ],
        bottleneckFindings: {
            highEfficiency: [
                `Evaluated ${kpis.totalActiveWarehouses} active warehouse depot locations across all scheduled shifts.`,
                'Consolidator batch verification flow remains stable across non-congested facilities.',
            ],
            primaryBottlenecks: [
                `${dockCongested.length} location(s) experiencing peak dock turnaround delays exceeding 45 minutes.`,
                'Carrier dispatch loading queues clustering during shift turnover windows.',
            ],
            criticalDelays: [
                `${spaceConstrained.length} warehouse(s) near full storage threshold, impeding cylinder movement.`,
            ],
        },
        keyTakeaways: [
            'Establish reserved carrier arrival windows to balance dock bay loading throughout shifts.',
            'Re-slot fastest moving cylinder categories adjacent to staging docks to reduce picker walking paths.',
        ],
        strategicRecommendations: [
            {
                title: 'Stagger Carrier Loading Schedules',
                description: 'Implement structured 30-minute arrival slots linked to pre-dispatch plan completion.',
                owner: 'Dock Staging Supervisor',
            },
            {
                title: 'Fast-Moving Cylinder Slotting Realignment',
                description: 'Relocate high-velocity serialized cylinder stock to bays immediately adjacent to staging lanes.',
                owner: 'Warehouse Operations Lead',
            },
        ],
        governanceDisclaimer: 'Advisory only. All proposals require human authorization prior to implementation.',
    };

    return {
        summary,
        keyHighlights,
        detailedAnalysis: `${summary}\n\nCross-facility benchmarking indicates that loading dock turnarounds and staged consolidations are the leading sources of variance. Staggering carrier pickup times and separating empty cylinder returns from full cylinder staging will immediately relieve dock lane congestion.`,
        keyExposures,
        strategicActions,
        executiveReport: tierSlug === 'executive' ? executiveReport : undefined,
        qaAnswer: userQuery ? summary : undefined,
        userQuery,
        isFallback: true,
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => ({}))) as AiInsightsRequestBody;
        const { kpis, rows, userQuery, chatHistory } = body;

        if (!kpis || !Array.isArray(rows)) {
            return NextResponse.json(
                { error: 'Invalid payload: kpis and rows are required.' },
                { status: 400 }
            );
        }

        const tierSlug: GlobalAiTierSlug = body.tierSlug && ['basic', 'pro', 'executive'].includes(body.tierSlug)
            ? (body.tierSlug as GlobalAiTierSlug)
            : 'basic';

        const isCustomQuery = Boolean(userQuery && userQuery.trim().length > 0);

        // Strict Tier Gating: Only Executive tier has access to interactive chatbot queries
        if (isCustomQuery && tierSlug !== 'executive') {
            return NextResponse.json(
                {
                    error: 'Interactive AI Chatbot is an Executive Tier capability. Please upgrade your subscription tier.',
                    summary: 'Interactive AI Chatbot is exclusive to the Executive Tier. Please review the operational summary.',
                },
                { status: 403 }
            );
        }

        const response = await runCoreAiAnalysis<
            {
                kpis: WarehouseEfficiencyKPIs;
                rows: WarehouseEfficiencyRow[];
                userQuery?: string;
                chatHistory?: ChatMessage[];
            },
            AiInsightResponse
        >({
            moduleName: 'warehouse-efficiency-intelligence-report',
            tierSlug,
            payload: {
                kpis,
                rows,
                userQuery: userQuery ? redactPiiFromString(userQuery) : undefined,
                chatHistory: chatHistory?.map((msg) => ({
                    ...msg,
                    content: redactPiiFromString(msg.content),
                })),
            },
            domainSystemInstruction: getDomainSystemInstructionForTier(tierSlug as AiTierSlug, isCustomQuery),
            buildPrompt: (sanitizedData) =>
                constructAnalysisPrompt(
                    sanitizedData.kpis,
                    sanitizedData.rows,
                    sanitizedData.userQuery,
                    sanitizedData.chatHistory
                ),
            sanitization: {
                stripSensitiveKeys: true,
                redactPii: true,
                maxItemsCap: 30,
            },
            parseResponse: (rawText: string) => {
                if (isCustomQuery) {
                    return {
                        summary: '',
                        userQuery,
                        qaAnswer: rawText.trim(),
                        isFallback: false,
                    };
                }

                const parsed = parseJsonSafe<Record<string, unknown>>(rawText);
                if (!parsed) return null;

                return {
                    summary: String(parsed.summary || ''),
                    keyHighlights: Array.isArray(parsed.keyHighlights) ? (parsed.keyHighlights as string[]) : undefined,
                    detailedAnalysis: typeof parsed.detailedAnalysis === 'string' ? parsed.detailedAnalysis : undefined,
                    keyExposures: Array.isArray(parsed.keyExposures) ? (parsed.keyExposures as AIObservation[]) : undefined,
                    strategicActions: Array.isArray(parsed.strategicActions) ? (parsed.strategicActions as AIObservation[]) : undefined,
                    executiveReport: parsed.executiveReport ? (parsed.executiveReport as ExecutiveReportSectionData) : undefined,
                    isFallback: false,
                };
            },
            fallbackEngine: (sanitizedData, tierPolicy) =>
                runDeterministicFallback(sanitizedData, tierPolicy),
        });

        const result: AiInsightResponse = {
            ...response.data,
            isFallback: response.governance.isFallback,
            metadata: response.governance,
        };

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error('[WarehouseEfficiencyAI] Fatal route error:', err);
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
