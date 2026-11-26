import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── In-Memory TTL Cache (30s) ──────────────────────────────────────────────
// Prevents repeated round-trips to the Spring Boot running-inventory view
// for the same branch within a short window. Keyed by branchId+branchName.
const inventoryCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

function getCached(key: string): unknown | null {
  const entry = inventoryCache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  inventoryCache.delete(key);
  return null;
}

function setCached(key: string, data: unknown): void {
  inventoryCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const springBase = process.env.SPRING_API_BASE_URL?.replace(/\/$/, '');

  if (!springBase) {
    console.error('[Proxy] SPRING_API_BASE_URL is not configured');
    return NextResponse.json({ error: 'SPRING_API_BASE_URL is not configured' }, { status: 500 });
  }

  // AG-COMMENT: Normalize branch identifier support (both snake_case branch_id and camelCase branchId)
  // Ensures view-running-inventory resolves sub-branches / bad stock branches reliably
  const branchId = searchParams.get('branchId') || searchParams.get('branch_id') || '';
  const branchName = searchParams.get('branchName') || '';
  const cacheKey = `inv:${branchId}:${branchName}`;

  // Return cached response if still fresh (avoids expensive DB view hit)
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[Proxy] Cache HIT for branch ${branchId} (${branchName})`);
    return NextResponse.json(cached);
  }

  // Construct the target external URL dynamically
  const targetUrl = new URL(`${springBase}/api/view-running-inventory/filter`);

  // Forward all query parameters
  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // Ensure both branch_id and branchId are populated on the target URL for Spring Boot filter compatibility
  if (branchId) {
    targetUrl.searchParams.set('branch_id', branchId);
    targetUrl.searchParams.set('branchId', branchId);
  }

  // Extract auth token from cookies or server environment fallback
  const token = request.cookies.get('vos_access_token')?.value || 
    request.cookies.get('springboot_token')?.value || 
    process.env.VOS_ACCESS_TOKEN || 
    process.env.vos_access_token;
  console.log(`[Proxy] Cache MISS — fetching: ${targetUrl.toString()}`);
  console.log(`[Proxy] Token present: ${!!token}, Length: ${token?.length}`);

  if (token) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      const tmpDir = path.resolve(process.cwd(), 'node_modules/.cache/vos-tokens');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      fs.writeFileSync(path.join(tmpDir, 'latest_token.txt'), token);
    } catch (err) {
      console.warn('[Proxy] Safe token write skipped:', err);
    }
  }

  try {
    const fetchHeaders: Record<string, string> = {
      'Accept': 'application/json',
      ...(token ? {
        'Authorization': `Bearer ${token}`,
        'Cookie': `vos_access_token=${token}`
      } : {}),
    };

    let response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: fetchHeaders,
      cache: 'no-store',
    });

    // AG-COMMENT: If name-based filter returned empty or 404, retry filtering strictly by numeric branch_id
    // This handles sub-branches (e.g. "Alaminos - Bad Stock") where string name comparison fails in Spring Boot
    if (response.ok) {
      let data = await response.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      
      if (list.length === 0 && branchId && branchName) {
        const fallbackUrl = new URL(`${springBase}/api/view-running-inventory/filter`);
        fallbackUrl.searchParams.set('branch_id', branchId);
        fallbackUrl.searchParams.set('branchId', branchId);
        
        console.log(`[Proxy] Name filter yielded 0 items, retrying with branch_id alone: ${fallbackUrl.toString()}`);
        const retryRes = await fetch(fallbackUrl.toString(), {
          method: 'GET',
          headers: fetchHeaders,
          cache: 'no-store',
        });
        
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryList = Array.isArray(retryData) ? retryData : (retryData.data || []);
          if (retryList.length > 0) {
            data = retryData;
          }
        }
      }

      // Cache successful response for 30s to prevent N+1 DB view queries
      setCached(cacheKey, data);
      return NextResponse.json(data);
    } else {
      const errText = await response.text();
      console.error(`[Proxy] API returned ${response.status}:`, errText);
      return NextResponse.json(
        { error: `External API returned status ${response.status}`, details: errText },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Inventory Proxy Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy inventory request', details: String(error) },
      { status: 500 }
    );
  }
}
