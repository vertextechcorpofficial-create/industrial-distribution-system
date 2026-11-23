/**
 * API Route — Parent Serialized Products for Demand Forecast Intelligence Report filter dropdown
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Returns all parent (parent_id IS NULL) serialized (is_serialized = 1) products
 * sorted alphabetically by description.
 *
 * Response: { data: Array<{ product_id: number; description: string }> }
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

/** Build standard Directus auth headers */
function directusHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getDirectusToken()}`,
    };
}

export async function GET() {
    try {
        const base = getDirectusBase();

        // Fetch parent serialized products only:
        // - filter[parent_id][_null]=true  → top-level products only (no variants)
        // - filter[is_serialized][_eq]=1   → serialized products per IDS business rule
        // - fields=product_id,description,product_name,product_code → includes product_name fallback
        const url = [
            `${base}/items/products`,
            `?filter[parent_id][_null]=true`,
            `&filter[is_serialized][_eq]=1`,
            `&fields=product_id,description,product_name,product_code`,
            `&limit=-1`,
        ].join('');

        const res = await fetch(url, {
            headers: directusHeaders(),
            cache: 'no-store',
        });

        if (!res.ok) {
            console.error(`[DemandForecastProducts] Directus fetch failed: status ${res.status}`);
            return NextResponse.json({ data: [] });
        }

        const json = await res.json().catch(() => ({ data: [] }));
        const raw = Array.isArray(json?.data) ? json.data : [];

        // Normalise shape and resolve product description with product_name and product_code fallback
        const products: Array<{ product_id: number; description: string }> = raw.map((p: Record<string, unknown>) => {
            const desc = typeof p.description === 'string' ? p.description.trim() : '';
            const pName = typeof p.product_name === 'string' ? p.product_name.trim() : '';
            const pCode = typeof p.product_code === 'string' ? p.product_code.trim() : '';
            const resolvedDescription = desc || pName || (pCode ? `Item ${pCode}` : `Product ${p.product_id}`);

            return {
                product_id: Number(p.product_id),
                description: resolvedDescription,
            };
        });

        // Sort alphabetically by resolved description
        products.sort((a, b) => a.description.localeCompare(b.description));

        return NextResponse.json({ data: products });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[DemandForecastProducts] Error:', msg);
        return NextResponse.json({ data: [] });
    }
}
