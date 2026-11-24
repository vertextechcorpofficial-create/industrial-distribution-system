/**
 * Client Service for Warehouse Efficiency Intelligence Report & AI Insights
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Query memoization cache with 60s TTL to prevent duplicate network calls on identical filters
 * - Cache invalidation when explicit refresh is requested
 */

import {
    WarehouseEfficiencyFilter,
    WarehouseEfficiencyReportPayload,
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
} from '../types';

// In-memory LRU cache for query memoization
interface CacheEntry {
    data: WarehouseEfficiencyReportPayload;
    timestamp: number;
}
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function buildFilterKey(filter: WarehouseEfficiencyFilter): string {
    return [
        filter.startDate || '',
        filter.endDate || '',
        String(filter.branchId || ''),
        filter.shift || 'ALL',
        filter.unitType || 'ALL',
        filter.bottleneck || 'ALL',
    ].join('|');
}

export async function fetchWarehouseEfficiencyData(
    filter: WarehouseEfficiencyFilter,
    bypassCache: boolean = false
): Promise<WarehouseEfficiencyReportPayload> {
    const key = buildFilterKey(filter);
    const now = Date.now();

    if (!bypassCache) {
        const cached = queryCache.get(key);
        if (cached && now - cached.timestamp < CACHE_TTL_MS) {
            return cached.data;
        }
    }

    const params = new URLSearchParams();
    if (filter.startDate) params.append('startDate', filter.startDate);
    if (filter.endDate) params.append('endDate', filter.endDate);
    if (filter.branchId) params.append('branchId', String(filter.branchId));
    if (filter.shift && filter.shift !== 'ALL') params.append('shift', filter.shift);
    if (filter.unitType && filter.unitType !== 'ALL') params.append('unitType', filter.unitType);
    if (filter.bottleneck && filter.bottleneck !== 'ALL') params.append('bottleneck', filter.bottleneck);

    const res = await fetch(`/api/ids/ai-reports/warehouse-efficiency-intelligence-report?${params.toString()}`, {
        cache: 'no-store',
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.details || errJson?.error || 'Failed to fetch warehouse efficiency data');
    }

    const result = (await res.json()) as WarehouseEfficiencyReportPayload;
    queryCache.set(key, { data: result, timestamp: now });
    return result;
}

export function clearWarehouseEfficiencyCache(): void {
    queryCache.clear();
}

export async function generateGeminiWarehouseInsights(
    reportData: WarehouseEfficiencyReportPayload,
    tierSlug: AiTierSlug,
    userQuery?: string,
    chatHistory?: ChatMessage[]
): Promise<AiInsightResponse> {
    const res = await fetch('/api/ids/ai-reports/warehouse-efficiency-intelligence-report/ai-insights', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            kpis: reportData.kpis,
            rows: reportData.rows,
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

export async function fetchBranchesList(): Promise<Array<{ id: number; branch_name: string; branch_code: string }>> {
    try {
        const res = await fetch('/api/ids/ai-reports/warehouse-efficiency-intelligence-report/branches', {
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}
