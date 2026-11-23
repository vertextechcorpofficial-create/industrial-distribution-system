/**
 * Gemini Prompt Templates & Tier System Instructions — Logistics and Delivery Reliability
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Executive tier asks for 4 pillars: arrival reliability, branch control, service recovery, fleet economics
 * - Every prompt states the measurement rule (arrival commitment required) so the model cannot
 *   silently widen or narrow the sample behind the headline percentage
 */

import {
    AiTierSlug,
    ChatMessage,
    FleetActivityRow,
    LateShipmentRootCauseRow,
    ReportExecutiveKPIs,
    RoutePerformanceRow,
    TripSummaryRow,
} from '../types';
import { ROOT_CAUSE_LABELS, formatDurationMinutes } from './logisticsMetrics';

export function getDomainSystemInstructionForTier(tierSlug: AiTierSlug, isCustomQuery = false): string {
    const baseDirectives = `
You are an experienced Head of Distribution and Logistics Reliability Advisor for an industrial gas distribution enterprise (IDS).
Strict Operating Constraints:
1. All recommendations are purely advisory and require human review before any dispatch, routing or staffing change is enacted.
2. Ground every assertion in the empirical trip metrics provided. Never invent trip numbers, plate numbers, customers, routes or GPS records.
3. Punctuality is measured ONLY on trips that carry a real arrival commitment (a promised arrival later than the promised departure). Trips without one are a planning-data gap, not a driver failure — say so rather than scoring them.
4. Distances, fuel litres, delivery proofs and GPS traces are largely NOT captured in this dataset. If a metric's coverage counter is low, state that the finding cannot be proven from evidence rather than inferring it.
5. Structure the response as clean professional Markdown, without code block fences.
`;

    if (isCustomQuery) {
        return `${baseDirectives}
Mode: EXECUTIVE CONVERSATIONAL ADVISOR & COPILOT
Persona & Tone:
- You are a knowledgeable, direct logistics director answering an executive in plain business language.
- Answer in 1 to 2 concise paragraphs. Bold only the figures and names that carry the answer.

STRICT RELEVANCE & ANTI-PIVOT GUARDRAILS:
1. Answer ONLY the question actually asked.
2. NO UNWARRANTED PIVOTS: greetings, capability questions, password/account questions or small talk get a clean, direct answer. Do not steer them into on-time percentages, late trips or route warnings unless the executive asked about them.
3. Selective Dataset Grounding: the trip dataset below is reference context. Use it only when the question concerns delivery timing, routes, branches, vehicles, drivers, service failures or distribution cost.
4. Anti-Repetition: never repeat prior turns verbatim or near-verbatim.
5. Privacy: driver names may already be redacted. Refer to a driver by the label given, never by guessing an identity.`;
    }

    if (tierSlug === 'basic') {
        return `${baseDirectives}
Current Tier: BASIC
Produce ONLY:
1. "summary": 1-2 sentences on arrival reliability across the measured sample.
2. "keyHighlights": 2 to 4 general bullet strings.
Do NOT generate detailedAnalysis, executiveReport, keyExposures or strategicActions.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "1 to 2 sentences summarizing delivery reliability.",
  "keyHighlights": [
    "General delivery observation 1",
    "General delivery observation 2"
  ]
}`;
    }

    if (tierSlug === 'pro') {
        return `${baseDirectives}
Current Tier: PRO
Produce an operational review:
1. "summary": review string with exact figures.
2. "detailedAnalysis": multi-paragraph narrative separating branch departure delay from road transit delay, and naming the routes and evidence gaps.
3. "keyExposures": top 2-3 risks, each with "id", "category", "finding", "supportingEvidence", "impactLevel" ('low'|'medium'|'high').
4. "strategicActions": top 2-3 actions, each with "id", "recommendedAction" (HOW, not what), "finding" (root cause context), "suggestedOwner" (e.g. 'Dispatch Supervisor', 'Logistics Head', 'Warehouse Operations').
Do NOT generate executiveReport.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "1 to 2 sentences summarizing operational status.",
  "detailedAnalysis": "Multi-paragraph diagnostic narrative.",
  "keyExposures": [
    { "id": "exp-1", "category": "Arrival reliability", "finding": "...", "supportingEvidence": "exact trip numbers", "impactLevel": "high" }
  ],
  "strategicActions": [
    { "id": "act-1", "recommendedAction": "...", "finding": "...", "suggestedOwner": "Dispatch Supervisor" }
  ]
}`;
    }

    return `${baseDirectives}
Current Tier: EXECUTIVE STRATEGIC
Deliver an ultra-concise C-Suite briefing on the Universal Executive Report Standard, with exact figures.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "Strictly 1 to 2 sentences on the delivery reliability posture.",
  "executiveReport": {
    "reportTitle": "Logistics and Delivery Reliability Executive Report",
    "preparedBy": "AI Logistics & Distribution Analyst",
    "focus": "Arrival commitments, route reliability, service failures and fleet utilization economics",
    "executiveSummary": "1 to 2 executive sentences giving the strategic diagnosis.",
    "metricsTable": [
      { "category": "On-time delivery (committed arrivals only)", "actual": "X%", "target": "95.0% Benchmark", "status": "Favorable" | "Needs Review" },
      { "category": "Mean absolute arrival error", "actual": "X h", "target": "Within tolerance window", "status": "Controlled" | "Elevated Risk" },
      { "category": "Trips without an arrival commitment", "actual": "X of Y", "target": "0 Unplanned", "status": "Critical" | "Stable" },
      { "category": "Failed deliveries (Unfulfilled stops)", "actual": "X of Y stops", "target": "<= 1.0% Ceiling", "status": "Elevated Risk" | "Controlled" },
      { "category": "Cost per unit delivered", "actual": "PHP X", "target": "Route benchmark", "status": "Informational" }
    ],
    "bottleneckFindings": {
      "highEfficiency": ["1-2 sentences on routes or vehicles performing well."],
      "primaryBottlenecks": ["1-2 sentences on branch departure discipline and the worst route."],
      "criticalDelays": ["1-2 sentences on the largest individual trip breaches and their evidence."]
    },
    "keyTakeaways": ["Takeaway 1 on measurement coverage.", "Takeaway 2 on service or cost exposure."],
    "strategicRecommendations": [
      { "title": "Action Title", "description": "HOW the action is executed.", "owner": "Dispatch Supervisor | Logistics Head | Warehouse Operations" }
    ]
  },
  "executivePillars": [
    { "pillar": "Delivery Reliability & Customer Commitment", "status": "CRITICAL" | "MODERATE" | "STABLE" | "ACTION_REQUIRED", "findings": "one sentence with exact figures" },
    { "pillar": "Branch Control & Dispatch Discipline", "status": "...", "findings": "..." },
    { "pillar": "Service Recovery & Evidence", "status": "...", "findings": "..." },
    { "pillar": "Fleet Utilization & Delivery Economics", "status": "...", "findings": "..." }
  ]
}`;
}

/** Compact the tabular payload so the prompt stays inside the data-minimization cap. */
function sanitizeTrips(trips: TripSummaryRow[]) {
    return trips.slice(0, 30).map((t) => ({
        trip: t.docNo,
        date: t.date,
        branch: t.depotBranchName,
        cluster: t.clusterName,
        vehicle: t.vehiclePlate,
        driver: t.driverName,
        arrivalState: t.arrivalState,
        hasArrivalCommitment: t.hasArrivalCommitment,
        etaError: formatDurationMinutes(t.etaErrorMinutes),
        departureLag: formatDurationMinutes(t.departureLagMinutes),
        rootCause: ROOT_CAUSE_LABELS[t.rootCauseCategory],
        stops: t.stopsCount,
        unfulfilledStops: t.unfulfilledStops,
        returnedStops: t.returnsStops,
        deliveredUnits: t.deliveredUnits,
        tripCost: t.tripCost,
        hasProof: t.hasProofs,
        hasGps: t.hasGpsLogs,
        hasNte: t.hasNte,
    }));
}

function sanitizeRoutes(routes: RoutePerformanceRow[]) {
    return routes.slice(0, 30).map((r) => ({
        route: `${r.depotBranchName} -> ${r.destinationCluster}`,
        trips: r.totalTrips,
        measurableTrips: r.measurableTrips,
        onTimeRate: r.onTimeRatePercentage !== null ? `${r.onTimeRatePercentage}%` : 'n/a',
        lateTrips: r.lateTrips,
        meanAbsoluteError: formatDurationMinutes(r.meanAbsoluteErrorMinutes),
        medianEtaError: formatDurationMinutes(r.medianEtaErrorMinutes),
        deliveredUnits: r.totalDeliveredUnits,
        costPerUnit: r.costPerDeliveredUnit,
    }));
}

function sanitizeLate(late: LateShipmentRootCauseRow[]) {
    return late.slice(0, 20).map((l) => ({
        trip: l.docNo,
        date: l.date,
        route: `${l.depotBranchName} -> ${l.clusterName}`,
        vehicle: l.vehiclePlate,
        etaError: formatDurationMinutes(l.etaErrorMinutes),
        departureLag: formatDurationMinutes(l.departureLagMinutes),
        rootCause: ROOT_CAUSE_LABELS[l.rootCauseCategory],
        unfulfilledStops: l.unfulfilledStops,
        returnedStops: l.returnsStops,
        evidence: l.remarksEvidence.slice(0, 4),
        nteDocs: l.nteDocNos.slice(0, 4),
    }));
}

function sanitizeFleet(fleet: FleetActivityRow[]) {
    return fleet.slice(0, 30).map((f) => ({
        vehicle: f.vehiclePlate,
        type: f.vehicleType,
        trips: f.totalTrips,
        activeDays: f.activeDays,
        stops: f.totalStops,
        deliveredUnits: f.totalDeliveredUnits,
        unfulfilledStops: f.unfulfilledStops,
        onTimeRate: f.onTimeRatePercentage !== null ? `${f.onTimeRatePercentage}%` : 'n/a',
        totalCost: f.totalCost,
        costPerUnit: f.costPerDeliveredUnit,
        ratedWeightKg: f.ratedWeightKg,
        ratedCbm: f.ratedCbm,
        fuelLitersLogged: f.totalFuelLiters,
    }));
}

function metricBlock(kpis: ReportExecutiveKPIs): string {
    return `Headline metrics (measured on trips with a real arrival commitment only):
- Posted dispatch trips in scope: ${kpis.totalTripsEvaluated}
- Measurable trips (arrival promised): ${kpis.measurableTripsCount}
- Trips with no arrival promised: ${kpis.uncommittedTripsCount}
- Trips with no arrival recorded: ${kpis.missingArrivalCount}
- On-time share: ${kpis.onTimeSharePercentage !== null ? `${kpis.onTimeSharePercentage}%` : 'n/a'} (tolerance ${kpis.toleranceMinutes} min)
- Late: ${kpis.lateTripsCount} | Early: ${kpis.earlyTripsCount} | On time: ${kpis.onTimeTripsCount}
- Mean absolute arrival error: ${formatDurationMinutes(kpis.meanAbsoluteErrorMinutes)}
- Median arrival error: ${formatDurationMinutes(kpis.medianEtaErrorMinutes)}
- Late branch departures: ${kpis.depotLateDeparturesCount} | Late on the road: ${kpis.roadLateArrivalsCount}
- Stops: ${kpis.totalStops} total, ${kpis.unfulfilledStopsCount} Unfulfilled (${kpis.unfulfilledStopsPercentage ?? 'n/a'}%), ${kpis.returnsStopsCount} with returns
- Units delivered (serialized products): ${kpis.totalDeliveredUnits}
- Trip cost: PHP ${kpis.totalTripCost}, average PHP ${kpis.averageCostPerDeliveredUnit ?? 'n/a'} per unit delivered
- Evidence coverage: proofs ${kpis.tripsWithProofs}, GPS ${kpis.tripsWithGpsLogs}, fuel logs ${kpis.tripsWithFuelLogs}, distances ${kpis.tripsWithDistance}, NTE ${kpis.tripsWithNte} (out of ${kpis.totalTripsEvaluated} trips)
- Arrival error distribution: ${kpis.etaBuckets.map((b) => `${b.label}: ${b.trips}`).join(' | ')}`;
}

export function constructAnalysisPrompt(
    tierSlug: AiTierSlug,
    kpis: ReportExecutiveKPIs,
    trips: TripSummaryRow[] = [],
    routes: RoutePerformanceRow[] = [],
    lateShipments: LateShipmentRootCauseRow[] = [],
    fleet: FleetActivityRow[] = [],
    userQuery?: string,
    chatHistory?: ChatMessage[]
): string {
    if (userQuery && userQuery.trim()) {
        const historyText =
            chatHistory && chatHistory.length > 0
                ? chatHistory
                      .slice(-6)
                      .map((m) => `${m.role === 'user' ? 'Executive' : 'Logistics Advisor'}: ${m.content}`)
                      .join('\n')
                : 'No prior conversation turns.';

        return `
The executive asked the following about the active logistics and delivery reliability dataset:
"${userQuery.trim()}"

Recent conversation turns:
${historyText}

${metricBlock(kpis)}

Route performance:
${JSON.stringify(sanitizeRoutes(routes), null, 2)}

Late trips with evidence:
${JSON.stringify(sanitizeLate(lateShipments), null, 2)}

Instructions:
- Answer in 1 to 2 short paragraphs, in plain business language, using exact figures in bold.
- Take account of the previous turns and do not repeat them.
- If the question is about routes, timing or cost, cite the specific trip or route label from the data above.
- If the question is unrelated (greeting, capability, password, small talk), answer only that question.
`;
    }

    return `
Analyze this Industrial Distribution System (IDS) Logistics and Delivery Reliability Report.

${metricBlock(kpis)}

Trip sample (up to 30 posted dispatches):
${JSON.stringify(sanitizeTrips(trips), null, 2)}

Route performance (branch -> destination cluster):
${JSON.stringify(sanitizeRoutes(routes), null, 2)}

Late trips with supporting evidence:
${JSON.stringify(sanitizeLate(lateShipments), null, 2)}

Fleet activity:
${JSON.stringify(sanitizeFleet(fleet), null, 2)}

Generate the ${tierSlug.toUpperCase()} JSON response adhering strictly to the instructed structure.
`;
}
