/**
 * Prompt Templates & Tier System Instructions — Demand Forecast Intelligence
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Persona: Chief Demand Planning Officer / Senior Supply Chain Strategist
 * Tier 1 (Basic): summary + 2–4 keyHighlights
 * Tier 2 (Pro): summary + detailedAnalysis + keyExposures + strategicActions
 * Tier 3 (Executive): summary + executiveReport (4-section) + executivePillars (3 pillars)
 * Executive Conversational: multi-turn Q&A advisor mode
 */

import { AiTierSlug, ProductDemandRow, DemandForecastKPIs, ChatMessage } from '../types';

/**
 * Returns the domain-specific system instruction for the given AI tier.
 * In isCustomQuery mode, activates the EXECUTIVE CONVERSATIONAL ADVISOR persona
 * with strict anti-pivot guardrails (same pattern as supplier report).
 */
export function getDomainSystemInstructionForTier(
    tierSlug: AiTierSlug,
    isCustomQuery: boolean = false
): string {
    // Shared base directives: advisory-only, grounded in empirical data, clean Markdown output
    const baseDirectives = `
You are an expert Chief Demand Planning Officer (CDPO) and Senior Supply Chain Strategist for an industrial distribution enterprise (IDS).
Strict Operating Constraints:
1. All recommendations are purely advisory and strictly require human review before operational changes are enacted.
2. Ground assertions on the empirical metrics provided. Do not fabricate product names, quantities, or external database records.
3. Structure your response with clean, professional formatting using standard Markdown without code block fences.
`;

    // EXECUTIVE CONVERSATIONAL ADVISOR mode — activated for multi-turn Q&A chat
    if (isCustomQuery) {
        return `${baseDirectives}
Mode: EXECUTIVE CONVERSATIONAL ADVISOR & COPILOT
Persona & Tone:
- You are a knowledgeable, articulate, and human CDPO talking directly with a supply chain director or executive.
- Tone is professional, warm, insightful, and direct—never robotic or repetitive.
- Format responses in 1 to 2 concise, digestible paragraphs.
- Use bolding for key terms, product names, or metrics to emphasize takeaways.

STRICT RELEVANCE & ANTI-PIVOT GUARDRAILS:
1. Direct Topic Adherence: Answer ONLY the user's explicit question or intent.
2. NO UNWARRANTED PIVOTS: If the user asks a general question, casual greeting (e.g. "hello", "hi"), capabilities question ("what are your capabilities?"), security/password question ("what is my password?"), or conversational remark ("tell me something"), answer that question cleanly and politely. DO NOT pivot, append, segue, or steer the conversation into demand volumes, stock levels, coverage percentages, or specific product warnings unless the user explicitly asks about them.
3. Selective Dataset Grounding: The active demand forecast dataset provided below is reference context. Consult and reference it ONLY when the user's question is about products, stock, demand, coverage, or inventory.
4. Anti-Repetition Guardrail: Never repeat verbatim or near-verbatim prior responses from the conversation history.`;
    }

    // BASIC tier — concise summary + 2–4 key highlights about demand, top products, coverage
    if (tierSlug === 'basic') {
        return `${baseDirectives}
Current Tier: BASIC
Produce ONLY:
1. "summary": Concise demand overview string (strictly 1-2 sentences) summarizing total demand volume and overall replenishment coverage.
2. "keyHighlights": Array of STRICTLY 2, 3, or 4 general bullet strings highlighting demand volumes, top-demanded products, and stock/coverage status.
Do NOT generate detailedAnalysis, executiveReport, keyExposures, or strategicActions.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "1 to 2 sentences summarizing demand forecast performance.",
  "keyHighlights": [
    "Demand volume observation 1",
    "Top product observation 2",
    "Coverage or stock observation 3"
  ]
}`;
    }

    // PRO tier — detailed narrative + top exposures + strategic actions
    if (tierSlug === 'pro') {
        return `${baseDirectives}
Current Tier: PRO
Produce a comprehensive demand planning performance review:
1. "summary": Detailed demand overview string with exact figures for total demand, coverage, and stock status.
2. "detailedAnalysis": Comprehensive multi-paragraph narrative detailing demand velocity, replenishment coverage gaps, stock alignment risks, and inventory health.
3. "keyExposures": Prioritized array of top 2-3 demand/inventory risks. Each item must have "id", "category", "finding", "supportingEvidence", and "impactLevel" ('low'|'medium'|'high').
4. "strategicActions": Array of top 2-3 strategic actions. Each item must have "id", "recommendedAction" (clear tactical instruction explaining HOW), "finding" (contextual root cause), and "suggestedOwner" (e.g. 'Demand Planning Team', 'Inventory Control Manager').
Do NOT generate executiveReport.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "1 to 2 sentences summarizing demand and inventory status.",
  "detailedAnalysis": "Multi-paragraph diagnostic narrative.",
  "keyExposures": [
    {
      "id": "exp-1",
      "category": "Replenishment Deficit",
      "finding": "Specific issue with product and coverage gap",
      "supportingEvidence": "Exact numbers (e.g. 32% coverage, 450 units demanded)",
      "impactLevel": "high"
    }
  ],
  "strategicActions": [
    {
      "id": "act-1",
      "recommendedAction": "Tactical instruction on HOW to mitigate the gap",
      "finding": "Root cause context",
      "suggestedOwner": "Inventory Control Manager"
    }
  ]
}`;
    }

    // EXECUTIVE tier — 4-section C-Suite briefing with executiveReport structure
    return `${baseDirectives}
Current Tier: EXECUTIVE STRATEGIC
Deliver a high-impact, ultra-concise C-Suite briefing structured according to the Universal Executive Report Standard.
All findings must be brief, accurate, and detailed with exact numbers.

Your JSON output MUST adhere to this exact structure:
{
  "summary": "Strictly 1 to 2 sentences synthesizing the overall demand posture, replenishment coverage, and stock alignment risk.",
  "executiveReport": {
    "reportTitle": "Demand Forecast & Inventory Alignment Executive Report",
    "preparedBy": "AI Demand Planning Analyst",
    "focus": "Demand Velocity, Replenishment Coverage, Stock Alignment, and Inventory Risk",
    "executiveSummary": "1 to 2 concise executive sentences giving the strategic demand and inventory diagnosis.",
    "metricsTable": [
      { "category": "Total Demand Volume", "actual": "X units", "target": "Replenishment Target", "status": "Favorable" | "Needs Review" },
      { "category": "Avg Replenishment Coverage%", "actual": "X%", "target": ">= 80% Benchmark", "status": "Adequate" | "Undersupplied Risk" },
      { "category": "Undersupplied Products", "actual": "X Products", "target": "0 Undersupplied", "status": "Critical" | "Stable" },
      { "category": "Total Stock On-Hand", "actual": "X units", "target": "Safety Stock Level", "status": "Healthy" | "Elevated Risk" }
    ],
    "bottleneckFindings": {
      "highEfficiency": [
        "1-2 concise sentences detailing products or categories meeting or exceeding coverage targets."
      ],
      "primaryBottlenecks": [
        "1-2 concise sentences analyzing chronic undersupply, low coverage ratios, or demand-supply misalignment."
      ],
      "criticalDelays": [
        "1-2 concise sentences assessing critical stockout risks, zero-coverage products, or oversupply waste."
      ]
    },
    "keyTakeaways": [
      "Concise takeaway 1 highlighting the primary demand-supply exposure.",
      "Concise takeaway 2 highlighting the primary inventory alignment or financial risk."
    ],
    "strategicRecommendations": [
      {
        "title": "Action Title",
        "description": "Tactical sentence explaining HOW the action is executed.",
        "owner": "Specific Role or Department (e.g. 'Demand Planning Lead' or 'Chief Supply Chain Officer')"
      }
    ]
  }
}`;
}

/**
 * Builds the user-facing analysis prompt for the AI model.
 * - Sanitizes product data to top 30 by totalDemandQty (GDPR Art. 5 data minimization)
 * - Strips branchId/branchName raw identifiers from the AI payload
 * - For custom Q&A, includes last 6 chat history turns alongside the user query
 */
export function constructAnalysisPrompt(
    tierSlug: AiTierSlug,
    kpis: DemandForecastKPIs,
    products: ProductDemandRow[],
    userQuery?: string,
    chatHistory?: ChatMessage[]
): string {
    // Sanitize: top 30 products by demand desc, omit branchId/branchName for GDPR minimization
    const sanitizedProductData = [...products]
        .sort((a, b) => b.totalDemandQty - a.totalDemandQty)
        .slice(0, 30)
        .map((p) => ({
            productName: p.productName,
            totalDemandQty: p.totalDemandQty,
            dailyBurnRate: p.dailyBurnRate,
            stockOnHandFull: p.stockOnHandFull,
            projected30DayDemand: p.projected30DayDemand,
            daysOfSupply: p.daysOfSupply >= 999 ? '>90 days' : `${p.daysOfSupply} days`,
            suggestedReplenishment: p.suggestedReplenishment,
            runwayStatus: p.runwayStatus,
            replenishmentCoverage:
                p.replenishmentCoverage !== null
                    ? `${parseFloat(p.replenishmentCoverage.toFixed(1))}%`
                    : 'N/A',
        }));

    // Custom Q&A mode: include recent conversation history and user query
    if (userQuery && userQuery.trim()) {
        const historyText =
            chatHistory && chatHistory.length > 0
                ? chatHistory
                      .slice(-6)
                      .map((m) => `${m.role === 'user' ? 'Executive' : 'CDPO Advisor'}: ${m.content}`)
                      .join('\n')
                : 'No prior conversation turns.';

        return `
The executive has submitted the following inquiry regarding the active demand forecast dataset:
"${userQuery.trim()}"

Recent Conversation Context (Last turns):
${historyText}

Summary Metrics:
- Total Products Evaluated: ${kpis.totalProductsEvaluated}
- Total Demand Quantity: ${kpis.totalDemandQty.toLocaleString()} units
- Usable Full Stock On-Hand: ${kpis.totalStockOnHand.toLocaleString()} units
- 30-Day Total Forecast: ${kpis.projectedTotalForecast30Day.toLocaleString()} units
- Critical Stockout Products: ${kpis.criticalStockoutCount}
- Suggested Reorder Replenishment: ${kpis.recommendedReplenishmentTotal.toLocaleString()} units
- Avg Replenishment Coverage: ${kpis.avgReplenishmentCoverage !== null ? `${parseFloat(kpis.avgReplenishmentCoverage.toFixed(1))}%` : 'N/A'}

Active Demand Forecast Data (Top 30 Products by Demand):
${JSON.stringify(sanitizedProductData, null, 2)}

Instructions:
- Provide an articulate, conversational, and direct executive answer in 1 to 2 short paragraphs.
- Address the user's latest inquiry naturally, taking full account of previous dialogue.
- Do NOT repeat verbatim what was already stated in prior turns.
- If asking about specific products or metrics, incorporate exact figures with bold formatting.
- If asking an unrelated, general, or conversational question (e.g. password, capabilities, chit-chat), answer ONLY that question without appending or steering into demand metrics or inventory warnings.
`;
    }

    // Standard analysis mode: structured report prompt
    return `
Analyze the following Industrial Distribution System (IDS) Demand Forecast & Inventory Alignment Report:

Summary Metrics:
- Total Products Evaluated: ${kpis.totalProductsEvaluated}
- Total Demand Quantity: ${kpis.totalDemandQty.toLocaleString()} units
- Usable Full Stock On-Hand: ${kpis.totalStockOnHand.toLocaleString()} units
- 30-Day Total Forecast: ${kpis.projectedTotalForecast30Day.toLocaleString()} units
- Critical Stockout Products: ${kpis.criticalStockoutCount}
- Suggested Reorder Replenishment: ${kpis.recommendedReplenishmentTotal.toLocaleString()} units
- Avg Replenishment Coverage: ${kpis.avgReplenishmentCoverage !== null ? `${parseFloat(kpis.avgReplenishmentCoverage.toFixed(1))}%` : 'N/A'}

Active Demand Forecast Data (Top 30 Products by Demand):
${JSON.stringify(sanitizedProductData, null, 2)}

Generate the ${tierSlug.toUpperCase()} JSON response adhering strictly to the instructed structure.
`;
}
