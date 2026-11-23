/**
 * API Route: product families for the Logistics and Delivery Reliability Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * The picker is scoped to serialized root products (the cylinder families an invoice line rolls up
 * to). Lines are keyed on product_id because descriptions are not guaranteed unique.
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
        // parent_id null = the family root; is_serialized = 1 = tracked per unit, i.e. a cylinder family
        const url =
            `${base}/items/products?filter[parent_id][_null]=true&filter[is_serialized][_eq]=1` +
            `&filter[isActive][_eq]=1&fields=product_id,description,product_name&sort=description&limit=-1`;
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getDirectusToken()}` },
            cache: 'no-store',
        });
        if (!res.ok) return NextResponse.json({ data: [] });

        const json = await res.json().catch(() => ({ data: [] }));
        const rows = Array.isArray(json?.data) ? json.data : [];
        const products = rows
            .map((p: Record<string, unknown>) => {
                // Real families ship with description = '' and a populated product_name (LPG 11KG,
                // LPG 21KG, LPG 50KG), so the picker must not fall through to a bare product_id.
                const label =
                    [p.description, p.product_name]
                        .map((v) => (v === null || v === undefined ? '' : String(v).trim()))
                        .find((t) => t.length > 0) || 'Unnamed product';
                return { id: Number(p.product_id), description: label };
            })
            .sort((a: { description: string }, b: { description: string }) => a.description.localeCompare(b.description));
        return NextResponse.json({ data: products });
    } catch {
        return NextResponse.json({ data: [] });
    }
}
