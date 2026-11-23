/**
 * Client Service for Inventory Health Report & AI Insights
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 */

import {
    InventoryHealthFilter,
    InventoryHealthReportPayload,
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
} from '../types';

export async function fetchInventoryHealthData(
    filter: InventoryHealthFilter
): Promise<InventoryHealthReportPayload> {
    const params = new URLSearchParams();
    if (filter.startDate) params.append('startDate', filter.startDate);
    if (filter.endDate) params.append('endDate', filter.endDate);
    if (filter.branchId) params.append('branchId', String(filter.branchId));
    if (filter.productId) params.append('productId', String(filter.productId));
    if (filter.riskBand) params.append('riskBand', filter.riskBand);

    const res = await fetch(`/api/ids/ai-reports/inventory-health-report?${params.toString()}`, {
        cache: 'no-store',
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.details || errJson?.error || 'Failed to fetch inventory health data');
    }

    return res.json();
}

export async function generateGeminiInsights(
    reportData: InventoryHealthReportPayload,
    tierSlug: AiTierSlug,
    userQuery?: string,
    chatHistory?: ChatMessage[]
): Promise<AiInsightResponse> {
    const res = await fetch('/api/ids/ai-reports/inventory-health-report/ai-insights', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            kpis: reportData.kpis,
            skus: reportData.skus,
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
        const res = await fetch('/api/ids/ai-reports/inventory-health-report/branches', {
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
        const res = await fetch('/api/pdf/company', {
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data?.[0] || null;
    } catch {
        return null;
    }
}
