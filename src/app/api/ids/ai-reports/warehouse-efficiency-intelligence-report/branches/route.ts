/**
 * Branches Route for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Scoped retrieval of active industrial distribution branches (division_id = 1 and isActive = 1)
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const cleaned = raw.trim().replace(/\/$/, '');
    if (!cleaned) throw new Error('DIRECTUS_URL is not configured.');
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
    return (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || '').trim();
}

export async function GET() {
    try {
        const base = getDirectusBase();
        const token = getDirectusToken();
        const url = `${base}/items/branches?filter[division_id][_eq]=1&filter[isActive][_eq]=1&fields=id,branch_name,branch_code&sort=branch_name&limit=-1`;

        const res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            console.warn(`[WarehouseEfficiencyBranches] Directus branches returned status ${res.status}`);
            return NextResponse.json({ data: [] });
        }

        const json = await res.json();
        return NextResponse.json(
            { data: json?.data || [] },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                },
            }
        );
    } catch (err) {
        console.error('[WarehouseEfficiencyBranches] Error fetching branches:', err);
        return NextResponse.json({ data: [] });
    }
}
