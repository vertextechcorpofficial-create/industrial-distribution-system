/**
 * API Route to fetch active industrial branches for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Scopes branches to Industrial Division (division_id = 1) and Active status (isActive = 1)
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
        const token = getDirectusToken();

        // Filter branches for Industrial Division (division_id = 1) and active status (isActive = 1)
        const url = `${base}/items/branches?filter[isActive][_eq]=1&filter[division_id][_eq]=1&sort=branch_name&limit=-1`;
        let res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        });

        // Fallback: If division_id filter fails or varies, fallback to division_id = 1 without isActive constraint
        if (!res.ok) {
            const fallbackUrl = `${base}/items/branches?filter[division_id][_eq]=1&limit=-1&sort=branch_name`;
            res = await fetch(fallbackUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                cache: 'no-store',
            });
        }

        if (!res.ok) {
            return NextResponse.json({ data: [] });
        }

        const json = await res.json().catch(() => ({ data: [] }));
        const rawBranches = Array.isArray(json?.data) ? json.data : [];

        const sanitizedBranches = rawBranches
            .map((b: { id?: number | string; branch_name?: string }) => ({
                id: Number(b.id || 0),
                branch_name: String(b.branch_name || `Branch #${b.id}`).trim(),
            }))
            .filter((b: { id: number; branch_name: string }) => b.id > 0);

        return NextResponse.json({ data: sanitizedBranches });
    } catch (err: unknown) {
        console.error('[InventoryHealth - Branches] Failed to fetch branches:', err);
        return NextResponse.json({ data: [] });
    }
}
