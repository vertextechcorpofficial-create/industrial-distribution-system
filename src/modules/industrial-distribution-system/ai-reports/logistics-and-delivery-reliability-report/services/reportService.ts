/**
 * Client service for the Logistics and Delivery Reliability Report & AI Insights
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 */

import {
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
    LogisticsReportFilter,
    LogisticsReportPayload,
} from '../types';

export async function fetchLogisticsReportData(
    filter: LogisticsReportFilter
): Promise<LogisticsReportPayload> {
    const params = new URLSearchParams();
    if (filter.startDate) params.append('startDate', filter.startDate);
    if (filter.endDate) params.append('endDate', filter.endDate);
    if (filter.branchId) params.append('branchId', String(filter.branchId));
    if (filter.productId) params.append('productId', String(filter.productId));
    // Tolerance is always sent: it is part of the measure, not an optional refinement.
    params.append('toleranceMinutes', String(filter.toleranceMinutes ?? 15));

    const res = await fetch(`/api/ids/ai-reports/logistics-and-delivery-reliability-report?${params.toString()}`, {
        cache: 'no-store',
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.details || errJson?.error || 'Failed to fetch logistics reliability data');
    }

    return res.json();
}

export async function generateGeminiInsights(
    reportData: LogisticsReportPayload,
    tierSlug: AiTierSlug,
    userQuery?: string,
    chatHistory?: ChatMessage[]
): Promise<AiInsightResponse> {
    const res = await fetch('/api/ids/ai-reports/logistics-and-delivery-reliability-report/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            kpis: reportData.kpis,
            trips: reportData.trips,
            routes: reportData.routes,
            lateShipments: reportData.lateShipments,
            fleet: reportData.fleet,
            tierSlug,
            userQuery,
            chatHistory,
        }),
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.details || errJson?.error || 'Failed to process AI insights');
    }

    return res.json();
}

export async function fetchBranchesList(): Promise<Array<{ id: number; branch_name: string }>> {
    try {
        const res = await fetch('/api/ids/ai-reports/logistics-and-delivery-reliability-report/branches', {
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}

export async function fetchProductFamilies(): Promise<Array<{ id: number; description: string }>> {
    try {
        const res = await fetch('/api/ids/ai-reports/logistics-and-delivery-reliability-report/products', {
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}

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
