/**
 * Gemini Prompt Templates & Tier System Instructions for Inventory Health
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Domain-specific CPO & Inventory Planning Advisor personas
 * - Multi-tier instruction schemas (Basic, Pro, Executive)
 * - Conversational anti-pivot guardrails for interactive Q&A

 */

import { AiTierSlug, SkuHealthRow, InventoryHealthExecutiveKPIs, ChatMessage } from '../types';

export function getDomainSystemInstructionForTier(tierSlug: AiTierSlug, isCustomQuery: boolean = false): string {
    const baseDirectives = `
You are an expert Chief Supply Chain Officer (CSCO) and Senior Industrial Inventory Planning Advisor for an industrial distribution enterprise (IDS).
Strict Operating Constraints:
1. All recommendations are purely advisory and strictly require human review before any replenishment, purchase requisition, or stock rebalancing is enacted.
2. Ground all assertions strictly on the empirical inventory metrics provided. Do not fabricate SKUs, cylinder serial numbers, or external warehouse records.
3. Structure your response with clean, professional formatting using standard Markdown without code block fences.
4. When daily demand is zero, Coverage Days must be treated as Unavailable (not zero, not infinity).
`;

    if (isCustomQuery) {
        return `${baseDirectives}
Mode: EXECUTIVE CONVERSATIONAL INVENTORY ADVISOR & COPILOT
Persona & Tone:
- You are an articulate, experienced CSCO talking directly with an industrial warehouse director or operations executive.
- Tone is professional, analytical, authoritative, and direct—never robotic or repetitive.
- Format responses in 1 to 2 concise, digestible paragraphs.
- Use bolding for key terms, SKU names, risk bands, or metrics to emphasize takeaways.

STRICT RELEVANCE & ANTI-PIVOT GUARDRAILS:
1. Direct Topic Adherence: Answer ONLY the user's explicit question or intent.
2. NO UNWARRANTED PIVOTS: If the user asks a general question, casual greeting (e.g. "hello", "hi"), capabilities question ("what are your capabilities?"), security question, or conversational remark, answer that question cleanly and politely. DO NOT pivot, append, segue, or steer the conversation into stockout stats, cylinder counts, or dead stock numbers unless the user explicitly asks about them.
3. Selective Dataset Grounding: The active inventory health dataset provided below is reference context. Consult and reference it ONLY when the user's question relates to inventory, cylinders, stock levels, stockout risks, safety stock, coverage days, or dead stock.
4. Anti-Repetition Guardrail: Never repeat verbatim or near-verbatim prior responses from the conversation history.`;
    }

    if (tierSlug === 'basic') {
        return `${baseDirectives}
Current Tier: BASIC
Produce ONLY:
1. "summary": Concise operational inventory health summary string (strictly 1-2 sentences) summarizing stockout risk and usable fleet availability.
2. "keyHighlights": Array of STRICTLY 2, 3, or 4 general bullet strings summarizing overall stock coverage, cylinder fleet balance, and dead stock observations.
Do NOT generate detailedAnalysis, executiveReport, keyExposures, or strategicActions.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "1 to 2 sentences summarizing inventory health posture.",
  "keyHighlights": [
    "General inventory observation 1",
    "General inventory observation 2",
    "General inventory observation 3"
  ]
}`;
    }

    if (tierSlug === 'pro') {
        return `${baseDirectives}
Current Tier: PRO
Produce an operational inventory health review:
1. "summary": Detailed operational review string with exact figures.
2. "detailedAnalysis": Comprehensive multi-paragraph narrative detailing SKU coverage, stockout vulnerabilities, cylinder fleet balance (usable vs empty vs defective vs customer-held), and dead stock capital drag.
3. "keyExposures": Prioritized array of top 2-3 operational risks. Each item must have "id", "category", "finding", "supportingEvidence", and "impactLevel" ('low'|'medium'|'high').
4. "strategicActions": Array of top 2-3 tactical actions. Each item must have "id", "recommendedAction" (clear tactical instruction explaining HOW to mitigate), "finding" (root cause context), and "suggestedOwner" (e.g. 'Warehouse Logistics', 'Demand Planning Lead', 'Cylinder Maintenance QA').
Do NOT generate executiveReport.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "1 to 2 sentences summarizing inventory status.",
  "detailedAnalysis": "Multi-paragraph diagnostic narrative.",
  "keyExposures": [
    {
      "id": "exp-1",
      "category": "Stockout Vulnerability",
      "finding": "Specific issue with SKU description",
      "supportingEvidence": "Exact numbers (e.g. 4.2 days coverage, 12 usable cylinders, ADS 2.8)",
      "impactLevel": "high"
    }
  ],
  "strategicActions": [
    {
      "id": "act-1",
      "recommendedAction": "Tactical instruction on HOW to resolve stock imbalance",
      "finding": "Root cause context",
      "suggestedOwner": "Warehouse Logistics"
    }
  ]
}`;
    }

    // Tier 3: Executive Strategic Standard Report
    return `${baseDirectives}
Current Tier: EXECUTIVE STRATEGIC
Deliver a high-impact, ultra-concise C-Suite briefing structured according to the Universal Executive Report Standard.
All findings must be brief, accurate, and detailed with exact numbers.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "Strictly 1 to 2 sentences synthesizing the overall fleet readiness and inventory risk posture.",
  "executiveReport": {
    "reportTitle": "Industrial Inventory Health & Fleet Optimization Executive Report",
    "preparedBy": "AI Inventory Health & Supply Chain Analyst",
    "focus": "Stockout Probability, Fleet Utilization, Safety Stock Variance, and Dead Stock Capital Recovery",
    "executiveSummary": "1 to 2 concise paragraphs synthesizing strategic findings across industrial branches.",
    "metricsTable": [
      {
        "category": "Critical Stockout Exposure",
        "actual": "X SKUs",
        "target": "0 Critical SKUs",
        "status": "Critical / Favorable"
      },
      {
        "category": "Fleet Utilization Rate",
        "actual": "X%",
        "target": "≥ 65.0% Benchmark",
        "status": "Healthy / Needs Review"
      },
      {
        "category": "Dead Stock Capital Drag",
        "actual": "PHP X.XX",
        "target": "PHP 0.00",
        "status": "Elevated Risk / Controlled"
      },
      {
        "category": "Defective Cylinder Drag",
        "actual": "X Cylinders",
        "target": "≤ 5.0% Fleet Share",
        "status": "Controlled / Elevated"
      }
    ],
    "bottleneckFindings": {
      "highEfficiency": [
        "Bullet describing SKUs with optimal replenishment coverage."
      ],
      "primaryBottlenecks": [
        "Bullet describing high stockout vulnerability or empty cylinder accumulation."
      ],
      "criticalDelays": [
        "Bullet describing long-term customer-held cylinders or dead stock aging."
      ]
    },
    "keyTakeaways": [
      "Strategic takeaway 1",
      "Strategic takeaway 2",
      "Strategic takeaway 3"
    ],
    "strategicRecommendations": [
      {
        "title": "Immediate Stockout Buffer Rebalancing",
        "description": "Specific tactical guidance on redistributing full cylinders or expediting filling.",
        "owner": "Branch Operations Manager"
      },
      {
        "title": "Dead Stock & Dormant Cylinder Recovery",
        "description": "Action plan to inspect, requalify, or repurpose stagnant cylinder assets.",
        "owner": "Asset Tracking Lead"
      }
    ]
  }
}`;
}

export function constructAnalysisPrompt(
    kpis: InventoryHealthExecutiveKPIs,
    skus: SkuHealthRow[],
    tierSlug: AiTierSlug,
    userQuery?: string,
    chatHistory?: ChatMessage[]
): string {
    const criticalSkus = skus
        .filter((s) => s.riskBand === 'CRITICAL' || s.riskBand === 'ELEVATED')
        .slice(0, 5)
        .map(
            (s) =>
                `- ${s.productName} (${s.productCode}): Usable Stock = ${s.fleet.usableAvailableQuantity}, ADS = ${s.averageDailyDemand.toFixed(
                    1
                )}, Coverage Days = ${s.coverageDays !== null ? s.coverageDays.toFixed(1) : 'Unavailable'}, Safety Target = ${s.safetyStockRecommendation}`
        )
        .join('\n');

    const deadStockSkus = skus
        .filter((s) => s.agingCategory === 'DEAD_STOCK' && s.fleet.usableAvailableQuantity > 0)
        .slice(0, 5)
        .map(
            (s) =>
                `- ${s.productName} (${s.productCode}): Usable Idle Stock = ${s.fleet.usableAvailableQuantity}, Tied-up Capital = PHP ${s.tiedUpCapital.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 }
                )}`
        )
        .join('\n');

    const datasetSummary = `
ENTERPRISE INVENTORY HEALTH SUMMARY (Empirical Metrics):
- Total Parent Serialized SKUs Evaluated: ${kpis.totalSkusEvaluated}
- Critical Stockout Risk SKUs (<7d coverage): ${kpis.criticalStockoutSkusCount}
- Elevated Risk SKUs (7-14d coverage): ${kpis.elevatedRiskSkusCount}
- Healthy SKUs (15-90d coverage): ${kpis.healthySkusCount}
- Excess Stock SKUs (>90d coverage): ${kpis.excessStockSkusCount}
- Dead Stock SKUs (>90d zero consumption): ${kpis.deadStockSkusCount}
- Total Fleet Assets: ${kpis.totalFleet}
- Usable / Full Cylinders on Hand: ${kpis.totalUsableFleet}
- Empty Cylinders on Hand: ${kpis.totalEmptyFleet}
- Cylinders with Customers: ${kpis.totalCustomerHeld}
- Defective / Damaged Cylinders: ${kpis.totalDefectiveFleet}
- Fleet Utilization (Customer Held / Total): ${kpis.fleetUtilizationRate !== null ? `${kpis.fleetUtilizationRate.toFixed(1)}%` : 'N/A'}
- Total Tied-Up Capital in Dead Stock: PHP ${kpis.totalTiedUpCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Selected Period: ${kpis.metadata.selectedPeriod}
- Calculation Basis: ${kpis.metadata.calculationBasis}

Top Critical Stockout SKUs:
${criticalSkus || 'None (all evaluated SKUs have adequate coverage).'}

Top Dead Stock SKUs:
${deadStockSkus || 'None (no dead stock detected in period).'}
`;

    if (userQuery) {
        let historyPrompt = '';
        if (chatHistory && chatHistory.length > 0) {
            historyPrompt = `\nPREVIOUS CONVERSATION HISTORY:\n${chatHistory
                .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
                .join('\n')}\n`;
        }

        return `${datasetSummary}
${historyPrompt}
EXECUTIVE USER INQUIRY:
"${userQuery}"

Provide a clear, direct, and actionable answer strictly adhering to the CSCO Persona and anti-pivot guardrails.`;
    }

    return `${datasetSummary}
INSTRUCTIONS:
Evaluate this empirical dataset and return the JSON response conforming exactly to the schema specified in the system instructions for tier ${tierSlug.toUpperCase()}.`;
}
