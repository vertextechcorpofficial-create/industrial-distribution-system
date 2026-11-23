/**
 * Inventory Health Report — Product lookup
 *
 * GET /api/ids/ai-reports/inventory-health-report/products
 *
 * Offers exactly the rows the report can name: serialized PARENT items sitting in
 * an industrial category. A picker that offered a non-industrial or child-variant
 * item would let the reader select a filter the report body then drops, which
 * reads as the report ignoring them.
 *
 * Keyed on product_id because descriptions are not unique on this master; the
 * label carries the code alongside so two same-named items stay separable.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RawCategory {
  category_id: number;
  is_industrial?: number | boolean | null;
}

interface RawProduct {
  product_id: number;
  parent_id?: number | string | null;
  description?: string | null;
  product_code?: string | null;
  product_category?: number | string | null;
  is_serialized?: number | boolean | null;
}

function getDirectusBase(): string {
  const raw =
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    '';
  const cleaned = raw.trim().replace(/\/$/, '');
  if (!cleaned) throw new Error('DIRECTUS_URL is not configured.');
  return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function directusHeaders(): Record<string, string> {
  const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || '').trim();
  if (!token) throw new Error('DIRECTUS_STATIC_TOKEN is not configured.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function fetchCollection<T>(collection: string, queryParams: string): Promise<T[]> {
  const res = await fetch(`${getDirectusBase()}/items/${collection}?${queryParams}`, {
    headers: directusHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`[InventoryHealth/products] ${collection} status ${res.status}`);
    return [];
  }
  const json = (await res.json().catch(() => ({ data: [] }))) as { data?: T[] };
  return json?.data || [];
}

/** bit(1)/tinyint columns arrive as boolean, 0/1 or a wrapped { data: [x] }. */
function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') return value.trim() === '1';
  if (Array.isArray(value)) return value.some((v) => isTruthyFlag(v));
  if (value && typeof value === 'object') {
    const wrapped = (value as { data?: unknown }).data;
    if (wrapped !== undefined) return isTruthyFlag(wrapped);
  }
  return false;
}

export async function GET() {
  try {
    const [categoryRows, productRows] = await Promise.all([
      fetchCollection<RawCategory>('categories', 'filter[is_industrial][_eq]=1&fields=category_id,is_industrial&limit=-1'),
      fetchCollection<RawProduct>(
        'products',
        'filter[is_serialized][_eq]=1&fields=product_id,parent_id,description,product_code,product_category,is_serialized&sort=description&limit=-1'
      ),
    ]);

    const industrialCategoryIds = new Set(
      categoryRows.filter((c) => isTruthyFlag(c.is_industrial)).map((c) => Number(c.category_id))
    );

    const data = productRows
      .filter((p) => {
        const parentId = Number(p.parent_id);
        const isParent = p.parent_id === null || p.parent_id === undefined || !Number.isFinite(parentId) || parentId <= 0;
        if (!isParent || !isTruthyFlag(p.is_serialized)) return false;
        const categoryId = Number(p.product_category);
        return Number.isFinite(categoryId) && industrialCategoryIds.has(categoryId);
      })
      .map((p) => {
        const description = String(p.description || '').trim();
        const code = p.product_code ? String(p.product_code).trim() : '';
        const label = [description || `Product ${p.product_id}`, code].filter(Boolean).join(' — ');
        return {
          product_id: Number(p.product_id),
          description: description || `Product ${p.product_id}`,
          product_code: code || null,
          label,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : 'Unknown error';
    console.error('[InventoryHealth/products Error]:', details);
    return NextResponse.json({ data: [], details });
  }
}
