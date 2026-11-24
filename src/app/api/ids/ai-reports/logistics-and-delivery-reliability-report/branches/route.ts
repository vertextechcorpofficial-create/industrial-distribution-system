/**
 * API Route: active Industrial branches for the Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Mirrors the trip scope of the data route: a branch is offered only when dispatches can actually be
 * attributed to it (branches.division_id = 1 AND branches.isActive = 1).
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const cleaned = raw.trim().replace(/\/$/, '');
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
    return (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || '').trim();
}

export async function GET() {
    try {
        const base = getDirectusBase();
        const url = `${base}/items/branches?filter[isActive][_eq]=1&filter[division_id][_eq]=1&fields=id,branch_name&sort=branch_name&limit=-1`;
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getDirectusToken()}` },
            cache: 'no-store',
        });
        if (!res.ok) return NextResponse.json({ data: [] });

        const json = await res.json().catch(() => ({ data: [] }));
        const rows = Array.isArray(json?.data) ? json.data : [];
        const branches = rows.map((b: Record<string, unknown>) => ({
            id: Number(b.id),
            // A bare id in the picker reads like a real branch code, so an unnamed row is labelled
            // as such rather than as "Branch 51".
            branch_name: String(b.branch_name || '').trim() || 'Unnamed branch',
        }));
        return NextResponse.json({ data: branches });
    } catch {
        return NextResponse.json({ data: [] });
    }
}
