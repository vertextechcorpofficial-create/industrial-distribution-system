/**
 * Client service for Demand Forecast Intelligence Report & AI Insights
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Functions:
 * - fetchDemandForecastData: Fetches aggregated demand + stock report data
 * - generateDemandAiInsights: Submits report data to the AI insights endpoint
 * - fetchBranchesList: Fetches Division 1 active branches for filter dropdown
 * - fetchProductsList: Fetches parent serialized products for filter dropdown
 * - fetchCompanyPdfData: Fetches company metadata for PDF export
 */

import {
    DemandForecastFilter,
    DemandForecastReportPayload,
    DemandAiInsightResponse,
    AiTierSlug,
    ChatMessage,
} from '../types';

/**
 * Fetches the aggregated demand forecast and inventory alignment report.
 * Maps filter params to query string; throws on non-OK response.
 */
export async function fetchDemandForecastData(
    filter: DemandForecastFilter
): Promise<DemandForecastReportPayload> {
    const params = new URLSearchParams();
    if (filter.startDate) params.append('startDate', filter.startDate);
    if (filter.endDate) params.append('endDate', filter.endDate);
    if (filter.branchId) params.append('branchId', String(filter.branchId));
    if (filter.productId) params.append('productId', String(filter.productId));

    const res = await fetch(
        `/api/ids/ai-reports/demand-forecast-intelligence-report?${params.toString()}`,
        { cache: 'no-store' }
    );

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
            errJson?.details || errJson?.error || 'Failed to fetch demand forecast data'
        );
    }

    return res.json();
}

/**
 * Submits the report payload (kpis + products) to the AI insights endpoint.
 * Supports optional custom Q&A query and chat history for executive conversational mode.
 * Throws on non-OK response.
 */
export async function generateDemandAiInsights(
    reportData: DemandForecastReportPayload,
    tierSlug: AiTierSlug,
    userQuery?: string,
    chatHistory?: ChatMessage[]
): Promise<DemandAiInsightResponse> {
    const res = await fetch(
        '/api/ids/ai-reports/demand-forecast-intelligence-report/ai-insights',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                kpis: reportData.kpis,
                products: reportData.products,
                tierSlug,
                userQuery,
                chatHistory,
            }),
        }
    );

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
            errJson?.details || errJson?.error || 'Failed to process AI demand forecast insights'
        );
    }

    return res.json();
}

/**
 * Fetches the list of active Division 1 branches for the filter dropdown.
 * Returns an empty array on failure to prevent UI breakage.
 */
export async function fetchBranchesList(): Promise<Array<{ id: number; branch_name: string }>> {
    try {
        const res = await fetch(
            '/api/ids/ai-reports/demand-forecast-intelligence-report/branches',
            { cache: 'no-store' }
        );
        if (!res.ok) return [];
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}

/**
 * Fetches the list of parent serialized products for the filter dropdown.
 * Returns an empty array on failure to prevent UI breakage.
 */
export async function fetchProductsList(): Promise<
    Array<{ product_id: number; description: string }>
> {
    try {
        const res = await fetch(
            '/api/ids/ai-reports/demand-forecast-intelligence-report/products',
            { cache: 'no-store' }
        );
        if (!res.ok) return [];
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}

/**
 * Fetches company metadata for PDF export header/footer population.
 * Returns null on failure; callers must handle gracefully.
 */
export async function fetchCompanyPdfData(): Promise<Record<string, unknown> | null> {
    try {
        const res = await fetch('/api/pdf/company', { cache: 'no-store' });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data?.[0] || null;
    } catch {
        return null;
    }
}
