/**
 * API Route — Active Branches (Division 1) for Demand Forecast Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Returns active branches filtered strictly to Industrial Division (division_id = 1)
 * with an additional in-memory guard to prevent cross-division data leakage.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve and normalise the Directus base URL */
function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const cleaned = raw.trim().replace(/\/$/, '');
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

/** Return the static Directus bearer token */
function getDirectusToken(): string {
    return (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || '').trim();
}

export async function GET() {
    try {
        const base = getDirectusBase();

        // Primary query: division_id = 1 AND isActive = 1, sorted by branch_name
        const url = `${base}/items/branches?filter[isActive][_eq]=1&filter[division_id][_eq]=1&sort=branch_name&limit=-1`;
        let res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getDirectusToken()}`,
            },
            cache: 'no-store',
        });

        // Fallback: drop isActive filter in case the field differs between environments
        if (!res.ok) {
            const fallbackUrl = `${base}/items/branches?filter[division_id][_eq]=1&limit=-1&sort=branch_name`;
            res = await fetch(fallbackUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getDirectusToken()}`,
                },
                cache: 'no-store',
            });
        }

        if (!res.ok) {
            return NextResponse.json({ data: [] });
        }

        const json = await res.json().catch(() => ({ data: [] }));
        const rawBranches = Array.isArray(json?.data) ? json.data : [];

        // In-memory guard: enforce division_id = 1 regardless of DB-side filter result
        const filteredBranches = rawBranches.filter((b: Record<string, unknown>) => {
            if (b.division_id !== undefined && b.division_id !== null) {
                return Number(b.division_id) === 1;
            }
            return true; // allow rows where division_id is not returned (trust DB filter)
        });

        // Normalise branch shape: { id, branch_name }
        const branches = filteredBranches.map((b: Record<string, unknown>) => ({
            id: Number(b.id),
            branch_name: String(b.branch_name || b.name || b.branch_code || `Branch ${b.id}`),
        }));

        return NextResponse.json({ data: branches });
    } catch {
        // Return empty list on any unexpected error — do not crash the caller
        return NextResponse.json({ data: [] });
    }
}
