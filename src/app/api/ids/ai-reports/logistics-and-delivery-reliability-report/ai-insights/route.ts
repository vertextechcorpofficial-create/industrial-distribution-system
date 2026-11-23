/**
 * Gemini AI Insights API Route for Logistics and Delivery Reliability
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Routing through the Centralized Core AI Layer (@/lib/ai) via runCoreAiAnalysis
 * - Dual-pass GDPR sanitization (PII scrubbing + data minimization, 30-row cap)
 * - Executive 4-pillar C-Suite report plus interactive Q&A
 * - Rule-based zero-crash deterministic fallback so the panel never blocks during outages
 */

import { NextRequest, NextResponse } from 'next/server';
import { runCoreAiAnalysis, parseJsonSafe, redactPiiFromString, TierPolicy, GlobalAiTierSlug } from '@/lib/ai';
import {
    AiTierSlug,
    AiInsightResponse,
    ChatMessage,
    ExecutivePillar,
    ExecutiveReportSectionData,
    FleetActivityRow,
    AIObservation,
    LateShipmentRootCauseRow,
    ReportExecutiveKPIs,
    RoutePerformanceRow,
    TripSummaryRow,
} from '@/modules/industrial-distribution-system/ai-reports/logistics-and-delivery-reliability-report/types';
import {
    ROOT_CAUSE_LABELS,
    formatDurationMinutes,
} from '@/modules/industrial-distribution-system/ai-reports/logistics-and-delivery-reliability-report/services/logisticsMetrics';
import {
    constructAnalysisPrompt,
    getDomainSystemInstructionForTier,
} from '@/modules/industrial-distribution-system/ai-reports/logistics-and-delivery-reliability-report/services/geminiPrompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DISCLAIMER =
    'AI recommendations are strictly advisory and require human review. They do not dispatch vehicles, reassign drivers, or alter operating policies.';

interface AiInsightsRequestBody {
    kpis: ReportExecutiveKPIs;
    trips?: TripSummaryRow[];
    routes?: RoutePerformanceRow[];
    lateShipments?: LateShipmentRootCauseRow[];
    fleet?: FleetActivityRow[];
    tierSlug?: AiTierSlug;
    userQuery?: string;
    chatHistory?: ChatMessage[];
}

interface FallbackPayload {
    kpis: ReportExecutiveKPIs;
    trips: TripSummaryRow[];
    routes: RoutePerformanceRow[];
    lateShipments: LateShipmentRootCauseRow[];
    fleet: FleetActivityRow[];
    userQuery?: string;
    chatHistory?: ChatMessage[];
}

/**
 * Deterministic offline fallback engine.
 * Every sentence is produced from the same aggregation the grids show, so an outage still yields a
 * correct, quotable read-out rather than a blank panel.
 */
function runDeterministicFallback(payload: FallbackPayload, tier: TierPolicy): AiInsightResponse {
    const { kpis, routes, lateShipments, fleet, userQuery } = payload;

    const tierSlug = tier.slug as AiTierSlug;
    const onTimeStr = kpis.onTimeSharePercentage !== null ? `${kpis.onTimeSharePercentage}%` : 'no measurable arrivals';
    const maeStr = formatDurationMinutes(kpis.meanAbsoluteErrorMinutes);
    const measurableStr = `${kpis.measurableTripsCount} of ${kpis.totalTripsEvaluated} posted trips`;

    // Routes ranked by measured punctuality, ignoring the ones that carry no commitment at all.
    const rankedRoutes = [...routes]
        .filter((r) => r.measurableTrips > 0 && r.onTimeRatePercentage !== null)
        .sort((a, b) => (a.onTimeRatePercentage ?? 0) - (b.onTimeRatePercentage ?? 0));
    const worstRoute = rankedRoutes[0];
    const bestRoute = rankedRoutes[rankedRoutes.length - 1];

    const worstTrip = lateShipments[0];
    const busyVehicle = [...fleet].sort((a, b) => b.totalTrips - a.totalTrips)[0];
    const costlyVehicle = [...fleet]
        .filter((f) => f.costPerDeliveredUnit !== null && f.totalDeliveredUnits > 0)
        .sort((a, b) => (b.costPerDeliveredUnit ?? 0) - (a.costPerDeliveredUnit ?? 0))[0];

    const causeCounts = lateShipments.reduce<Record<string, number>>((acc, row) => {
        acc[row.rootCauseCategory] = (acc[row.rootCauseCategory] || 0) + 1;
        return acc;
    }, {});
    const dominantCause = Object.entries(causeCounts).sort((a, b) => b[1] - a[1])[0];

    const summary = `Delivery reliability across ${measurableStr} carrying a real arrival promise stands at ${onTimeStr} on time, with an average arrival miss of ${maeStr}. ${kpis.lateTripsCount} trip(s) breached the ${kpis.toleranceMinutes}-minute window and ${kpis.uncommittedTripsCount} trip(s) never had an arrival time committed, which is itself a planning gap.`;

    const keyHighlights: string[] = [
        `On-time delivery performance is ${onTimeStr} measured over ${kpis.measurableTripsCount} trips with a committed arrival time.`,
        `Late arrivals concentrate in ${worstRoute ? `${worstRoute.depotBranchName} to ${worstRoute.destinationCluster}` : 'the branch network'}.`,
        `${kpis.depotLateDeparturesCount} trip(s) left the branch after the planned dispatch time, versus ${kpis.roadLateArrivalsCount} trip(s) that lost time on the road.`,
        `${kpis.unfulfilledStopsCount} of ${kpis.totalStops} delivery stops (${kpis.unfulfilledStopsPercentage ?? 0}%) were recorded Unfulfilled.`,
    ];

    const detailedAnalysis = `Of ${kpis.totalTripsEvaluated} posted industrial dispatches, ${kpis.measurableTripsCount} can actually be scored because the plan carries an arrival time later than the dispatch time; ${kpis.uncommittedTripsCount} repeat the dispatch clock into the arrival field and ${kpis.missingArrivalCount} never recorded an arrival at all. Measured performance is ${onTimeStr} with a median arrival error of ${formatDurationMinutes(kpis.medianEtaErrorMinutes)} and a mean absolute error of ${maeStr}. The dominant cause of lateness is ${dominantCause ? ROOT_CAUSE_LABELS[dominantCause[0] as keyof typeof ROOT_CAUSE_LABELS] : 'not concentrated'}. ${worstTrip ? `The worst single delivery was ${worstTrip.docNo} on ${worstTrip.date} from ${worstTrip.depotBranchName} toward ${worstTrip.clusterName}, ${formatDurationMinutes(worstTrip.etaErrorMinutes)} behind its promise.` : ''} ${busyVehicle ? `Utilization is carried mainly by ${busyVehicle.vehiclePlate} (${busyVehicle.totalTrips} trips across ${busyVehicle.activeDays} days).` : ''} Evidence coverage remains thin: delivery proofs on ${kpis.tripsWithProofs} trip(s), GPS on ${kpis.tripsWithGpsLogs}, fuel logs on ${kpis.tripsWithFuelLogs}, which limits how far any root cause can be proven rather than inferred.`;

    const keyExposures: AIObservation[] = [
        {
            id: 'exp-1',
            category: 'Arrival reliability',
            finding: worstRoute
                ? `${worstRoute.depotBranchName} to ${worstRoute.destinationCluster} delivered only ${worstRoute.onTimeRatePercentage}% of ${worstRoute.measurableTrips} measurable trips on time.`
                : 'No route in scope carries enough committed arrivals to prove reliability either way.',
            supportingEvidence: worstRoute
                ? `Mean absolute arrival error ${formatDurationMinutes(worstRoute.meanAbsoluteErrorMinutes)} over ${worstRoute.totalTrips} trips.`
                : `${kpis.uncommittedTripsCount} trip(s) have no arrival commitment recorded.`,
            impactLevel: 'high',
        },
        {
            id: 'exp-2',
            category: 'Data completeness',
            finding: `${kpis.uncommittedTripsCount} of ${kpis.totalTripsEvaluated} posted trips were dispatched without a promised arrival time.`,
            supportingEvidence: `Those trips cannot be scored for punctuality at all, so the headline share describes ${kpis.measurableTripsCount} trip(s) out of ${kpis.totalTripsEvaluated}.`,
            impactLevel: 'high',
        },
        {
            id: 'exp-3',
            category: 'Service failure',
            finding: `${kpis.unfulfilledStopsCount} delivery stop(s) ended Unfulfilled.`,
            supportingEvidence: `${kpis.returnsStopsCount} further stop(s) were fulfilled with returns; only ${kpis.tripsWithNte} trip(s) carry an explanatory Notice to Explain.`,
            impactLevel: 'medium',
        },
    ];

    const strategicActions: AIObservation[] = [
        {
            id: 'act-1',
            recommendedAction:
                'Make estimated_time_of_arrival mandatory and strictly later than estimated_time_of_dispatch when a dispatch is approved.',
            finding: `${kpis.uncommittedTripsCount} trip(s) carry an arrival time identical to the dispatch time, which removes them from any punctuality measure.`,
            suggestedOwner: 'Dispatch Supervisor',
        },
        {
            id: 'act-2',
            recommendedAction: dominantCause && dominantCause[0].includes('DEPOT')
                ? 'Move branch cut-off times earlier for the affected routes and measure the same window again next period.'
                : 'Review route sequencing and vehicle assignment for the clusters that lose time on the road.',
            finding: `${dominantCause ? ROOT_CAUSE_LABELS[dominantCause[0] as keyof typeof ROOT_CAUSE_LABELS] : 'Lateness'} accounts for ${dominantCause ? dominantCause[1] : 0} of ${lateShipments.length} late trip(s).`,
            suggestedOwner: 'Logistics Head',
        },
        {
            id: 'act-3',
            recommendedAction:
                'Require a delivery proof and a reason code on every stop that is not fulfilled, before the dispatch can be cleared.',
            finding: `Only ${kpis.tripsWithProofs} trip(s) in scope have a captured proof while ${kpis.unfulfilledStopsCount} stop(s) failed delivery.`,
            suggestedOwner: 'Warehouse Operations',
        },
    ];

    const executiveReport: ExecutiveReportSectionData = {
        reportTitle: 'Logistics and Delivery Reliability Executive Report',
        preparedBy: 'AI Logistics & Distribution Analyst',
        focus: 'Arrival commitments, route-level reliability, service failures and fleet utilization economics',
        executiveSummary: summary,
        metricsTable: [
            {
                category: 'On-time delivery (committed arrivals only)',
                actual: onTimeStr,
                target: '95.0% Benchmark',
                status: (kpis.onTimeSharePercentage ?? 0) >= 95 ? 'Favorable' : 'Needs Review',
            },
            {
                category: 'Mean absolute arrival error',
                actual: maeStr,
                target: `Within ${kpis.toleranceMinutes} min window`,
                status: kpis.meanAbsoluteErrorMinutes !== null && Math.abs(kpis.meanAbsoluteErrorMinutes) <= kpis.toleranceMinutes ? 'Controlled' : 'Elevated Risk',
            },
            {
                category: 'Trips without an arrival commitment',
                actual: `${kpis.uncommittedTripsCount} of ${kpis.totalTripsEvaluated}`,
                target: '0 Unplanned',
                status: kpis.uncommittedTripsCount === 0 ? 'Stable' : 'Critical',
            },
            {
                category: 'Failed deliveries (Unfulfilled stops)',
                actual: `${kpis.unfulfilledStopsCount} of ${kpis.totalStops}`,
                target: '≤ 1.0% Ceiling',
                status: (kpis.unfulfilledStopsPercentage ?? 0) <= 1 ? 'Controlled' : 'Elevated Risk',
            },
            {
                category: 'Cost per unit delivered',
                actual: kpis.averageCostPerDeliveredUnit !== null ? `PHP ${kpis.averageCostPerDeliveredUnit}` : 'N/A',
                target: 'Route benchmark',
                status: 'Informational',
            },
        ],
        bottleneckFindings: {
            highEfficiency: bestRoute
                ? [`${bestRoute.depotBranchName} to ${bestRoute.destinationCluster} held ${bestRoute.onTimeRatePercentage}% on-time over ${bestRoute.measurableTrips} measurable trip(s).`, `${busyVehicle ? busyVehicle.vehiclePlate : 'The busiest unit'} ran ${busyVehicle ? busyVehicle.totalTrips : 0} trip(s) on ${busyVehicle ? busyVehicle.activeDays : 0} separate days.`]
                : ['No route clears the measurable-trip bar, so no positive benchmark can be quoted this period.'],
            primaryBottlenecks: [
                worstRoute
                    ? `${worstRoute.depotBranchName} to ${worstRoute.destinationCluster}: ${worstRoute.lateTrips} late trip(s) out of ${worstRoute.measurableTrips} measurable.`
                    : 'Lateness is not yet attributable to a single route because too few trips promise an arrival.',
                `${kpis.depotLateDeparturesCount} trip(s) were already late leaving the branch, which transfers the delay to the customer before the vehicle moves.`,
            ],
            criticalDelays: [
                worstTrip
                    ? `${worstTrip.docNo} (${worstTrip.date}) arrived ${formatDurationMinutes(worstTrip.etaErrorMinutes)} after its committed time on the ${worstTrip.depotBranchName} to ${worstTrip.clusterName} run.`
                    : 'No trip breached the tolerance window in this selection.',
            ],
        },
        keyTakeaways: [
            `Reliability is measurable on only ${kpis.measurableTripsCount} of ${kpis.totalTripsEvaluated} posted trips; the planning record, not the road, is the first thing to fix.`,
            `Where it can be measured, ${onTimeStr} on time with a ${maeStr} average miss is materially below a 95% service commitment.`,
            `Proof-of-delivery, GPS and fuel coverage (${kpis.tripsWithProofs}/${kpis.tripsWithGpsLogs}/${kpis.tripsWithFuelLogs}) is too thin to defend any root cause externally.`,
        ],
        strategicRecommendations: [
            {
                title: 'Enforce arrival commitments at dispatch approval',
                description: 'Block approval of any dispatch whose estimated arrival is not strictly later than its estimated dispatch, so punctuality can be measured on the whole corpus rather than a minority of it.',
                owner: 'Dispatch Supervisor',
            },
            {
                title: 'Re-cut branch cut-offs on the worst route',
                description: worstRoute
                    ? `${worstRoute.depotBranchName} to ${worstRoute.destinationCluster} shows ${worstRoute.onTimeRatePercentage}% on time across ${worstRoute.measurableTrips} measurable trips; move its loading cut-off earlier and re-measure next period.`
                    : 'No route has enough committed arrivals to target yet; start by capturing commitments.',
                owner: 'Logistics Head',
            },
            {
                title: 'Close the evidence gap before the next customer claim',
                description: `Mandate a delivery proof and reason code on every stop; today only ${kpis.tripsWithProofs} trip(s) in scope carry one while ${kpis.unfulfilledStopsCount} stop(s) failed delivery.`,
                owner: 'Warehouse Operations',
            },
        ],
    };

    const executivePillars: ExecutivePillar[] = [
        {
            pillar: 'Delivery Reliability & Customer Commitment',
            status: (kpis.onTimeSharePercentage ?? 0) >= 95 ? 'STABLE' : 'CRITICAL',
            findings: `${onTimeStr} of ${kpis.measurableTripsCount} measurable trips arrived within the ${kpis.toleranceMinutes}-minute window; average miss ${maeStr}.`,
        },
        {
            pillar: 'Branch Control & Dispatch Discipline',
            status: kpis.depotLateDeparturesCount > kpis.roadLateArrivalsCount ? 'ACTION_REQUIRED' : 'MODERATE',
            findings: `${kpis.depotLateDeparturesCount} trip(s) departed after their planned dispatch time versus ${kpis.roadLateArrivalsCount} losing time on the road, and ${kpis.uncommittedTripsCount} trip(s) carried no arrival promise at all.`,
        },
        {
            pillar: 'Service Recovery & Evidence',
            status: kpis.unfulfilledStopsCount > 0 ? 'ACTION_REQUIRED' : 'STABLE',
            findings: `${kpis.unfulfilledStopsCount} stop(s) ended Unfulfilled and ${kpis.returnsStopsCount} were fulfilled with returns; only ${kpis.tripsWithNte} trip(s) carry a Notice to Explain.`,
        },
        {
            pillar: 'Fleet Utilization & Delivery Economics',
            status: 'MODERATE',
            findings: `${kpis.totalTripsEvaluated} trip(s) moved ${kpis.totalDeliveredUnits} unit(s) for PHP ${kpis.totalTripCost.toLocaleString('en-PH')}${costlyVehicle ? `, the most expensive unit being ${costlyVehicle.vehiclePlate} at PHP ${costlyVehicle.costPerDeliveredUnit} per ${costlyVehicle.totalDeliveredUnits} unit(s)` : ''}.`,
        },
    ];

    let qaAnswer: string | undefined;
    if (userQuery) {
        const q = userQuery.toLowerCase();
        if (q.includes('password') || q.includes('credential') || q.includes('account')) {
            qaAnswer =
                'I operate read-only against the dispatch records and have no access to accounts or credentials. For access problems, contact your internal IT administrator.';
        } else if (q.includes('capabilit') || q.includes('what can you do') || q.includes('what do you do')) {
            qaAnswer =
                'I am your Logistics and Delivery Reliability analyst. I read posted dispatch trips and explain arrival punctuality against committed ETAs, split lateness between branch departure and road transit, rank routes and vehicles, and quantify delivery failures and their cost per unit delivered.';
        } else if (q.includes('route') || q.includes('lane') || q.includes('cluster')) {
            const top = [...routes].sort((a, b) => b.totalTrips - a.totalTrips).slice(0, 3);
            qaAnswer = top.length
                ? `The busiest routes are ${top.map((r) => `${r.depotBranchName} to ${r.destinationCluster} (${r.totalTrips} trips, ${r.onTimeRatePercentage ?? 'n/a'}% on time of ${r.measurableTrips} measurable)`).join('; ')}.`
                : 'No route grouping is available for the current filter.';
        } else if (q.includes('late') || q.includes('delay') || q.includes('why')) {
            qaAnswer = worstTrip
                ? `The largest breach is **${worstTrip.docNo}** on ${worstTrip.date} (${worstTrip.depotBranchName} to ${worstTrip.clusterName}), **${formatDurationMinutes(worstTrip.etaErrorMinutes)}** past its committed arrival. It left the branch ${formatDurationMinutes(worstTrip.departureLagMinutes)} after the planned dispatch, classified as **${ROOT_CAUSE_LABELS[worstTrip.rootCauseCategory]}**. ${kpis.depotLateDeparturesCount} trip(s) in this selection were late at the branch and ${kpis.roadLateArrivalsCount} on the road.`
                : `No trip breached the ${kpis.toleranceMinutes}-minute window in this selection, although ${kpis.uncommittedTripsCount} trip(s) had no arrival commitment to measure against.`;
        } else if (q.includes('vehicle') || q.includes('truck') || q.includes('fleet') || q.includes('utiliz')) {
            // Rated weight and tank size are usually absent, so the sentence has to read correctly
            // both ways instead of stitching fragments together.
            const ratingLine =
                busyVehicle && (busyVehicle.ratedWeightKg || busyVehicle.fuelTankLiters)
                    ? `It is rated at ${busyVehicle.ratedWeightKg ? `${busyVehicle.ratedWeightKg} kg` : 'an unrecorded weight'}${
                          busyVehicle.fuelTankLiters ? ` with a ${busyVehicle.fuelTankLiters} l tank` : ''
                      }.`
                    : 'Its rated weight and tank capacity are not on the fleet register.';
            qaAnswer = busyVehicle
                ? `By activity, **${busyVehicle.vehiclePlate}** (${busyVehicle.vehicleType || '-'}) ran **${busyVehicle.totalTrips}** trip(s) over **${busyVehicle.activeDays}** day(s), delivering ${busyVehicle.totalDeliveredUnits} unit(s) at PHP ${busyVehicle.costPerDeliveredUnit ?? 'n/a'} per unit. ${ratingLine}`
                : 'No vehicle activity is available for the current filter.';
        } else if (q.includes('cost') || q.includes('spend') || q.includes('fuel')) {
            qaAnswer = `Trip cost in scope is **PHP ${kpis.totalTripCost.toLocaleString('en-PH')}** across ${kpis.totalTripsEvaluated} trip(s) for **${kpis.totalDeliveredUnits}** unit(s) delivered — about **PHP ${kpis.averageCostPerDeliveredUnit ?? 'n/a'}** per unit. Fuel allocations are logged on only ${kpis.tripsWithFuelLogs} trip(s), so cost-per-unit is the defensible efficiency measure here, not litres per kilometre.`;
        } else if (q.includes('hello') || q.includes('hi') || q.includes('good morning') || q.includes('good afternoon')) {
            qaAnswer =
                'Hello. Ask me about arrival punctuality, which routes or vehicles are late, why a trip missed its ETA, or what delivery is costing per unit.';
        } else {
            qaAnswer = `On this selection, ${onTimeStr} of ${kpis.measurableTripsCount} measurable trips were on time and ${kpis.lateTripsCount} breached the ${kpis.toleranceMinutes}-minute window${worstRoute ? `, concentrated on ${worstRoute.depotBranchName} to ${worstRoute.destinationCluster}` : ''}. ${kpis.uncommittedTripsCount} trip(s) carry no arrival commitment, which caps how much of the fleet can be scored at all.`;
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
        disclaimer: DISCLAIMER,
    };
}

export async function POST(req: NextRequest) {
    try {
        const body: AiInsightsRequestBody = await req.json().catch(() => ({}));
        const { kpis, trips = [], routes = [], lateShipments = [], fleet = [], tierSlug = 'basic', userQuery, chatHistory } = body;

        if (!kpis || typeof kpis !== 'object') {
            return NextResponse.json({ error: 'Invalid payload: report KPIs are required.' }, { status: 400 });
        }

        // GDPR dual pass: scrub the free-text question, then cap and strip the tabular payload.
        const sanitizedUserQuery = userQuery ? redactPiiFromString(userQuery.trim()) : undefined;
        const isCustomQuery = Boolean(sanitizedUserQuery);

        const payload: FallbackPayload = { kpis, trips, routes, lateShipments, fleet, userQuery: sanitizedUserQuery, chatHistory };

        const coreResponse = await runCoreAiAnalysis<FallbackPayload, AiInsightResponse>(
            {
                moduleName: 'logistics-and-delivery-reliability-report',
                tierSlug: tierSlug as GlobalAiTierSlug,
                payload,
                domainSystemInstruction: getDomainSystemInstructionForTier(tierSlug, isCustomQuery),
                buildPrompt: (data) =>
                    constructAnalysisPrompt(
                        tierSlug,
                        data.kpis,
                        data.trips,
                        data.routes,
                        data.lateShipments,
                        data.fleet,
                        data.userQuery,
                        data.chatHistory
                    ),
                fallbackEngine: (data, tier) => runDeterministicFallback(data, tier),
                parseResponse: (rawText: string) => {
                    const tierName = tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1);
                    if (isCustomQuery) {
                        return {
                            tierSlug,
                            tierName,
                            model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                            summary: '',
                            keyExposures: [],
                            strategicActions: [],
                            userQuery: sanitizedUserQuery,
                            qaAnswer: rawText,
                            disclaimer: DISCLAIMER,
                        };
                    }

                    const parsedJson = parseJsonSafe<Partial<AiInsightResponse>>(rawText);
                    if (parsedJson && (parsedJson.summary || parsedJson.executiveReport)) {
                        return {
                            tierSlug,
                            tierName,
                            model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                            summary: parsedJson.summary || parsedJson.executiveReport?.executiveSummary || '',
                            keyHighlights: Array.isArray(parsedJson.keyHighlights) ? parsedJson.keyHighlights.slice(0, 4) : undefined,
                            detailedAnalysis: parsedJson.detailedAnalysis,
                            keyExposures: parsedJson.keyExposures,
                            strategicActions: parsedJson.strategicActions,
                            executiveReport: parsedJson.executiveReport,
                            executivePillars: Array.isArray(parsedJson.executivePillars)
                                ? (parsedJson.executivePillars as ExecutivePillar[])
                                : undefined,
                            disclaimer: DISCLAIMER,
                        };
                    }

                    // The model answered in prose; keep the sentences and restate the measured baseline.
                    const onTimeStr = kpis.onTimeSharePercentage !== null ? `${kpis.onTimeSharePercentage}%` : 'n/a';
                    return {
                        tierSlug,
                        tierName,
                        model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                        summary: rawText.slice(0, 400),
                        keyExposures: [
                            `${kpis.totalTripsEvaluated} posted dispatches evaluated; ${kpis.measurableTripsCount} carry a measurable arrival commitment.`,
                            `On-time delivery at ${onTimeStr} against a ${kpis.toleranceMinutes}-minute tolerance.`,
                            `${kpis.unfulfilledStopsCount} delivery stop(s) recorded Unfulfilled.`,
                        ],
                        strategicActions: [
                            'Make the estimated arrival time mandatory at dispatch approval.',
                            'Re-cut branch loading cut-offs on the routes with the lowest on-time share.',
                            'Require a delivery proof and reason code before a dispatch can be cleared.',
                        ],
                        disclaimer: DISCLAIMER,
                    };
                },
                sanitization: {
                    maxItemsCap: 30, // Data minimization, GDPR Art. 5
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
        console.error('[LogisticsReliability AI Route Error]:', errorMsg);
        return NextResponse.json({ error: 'Failed to process AI request', details: errorMsg }, { status: 500 });
    }
}
