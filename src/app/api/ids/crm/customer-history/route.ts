// ============================================================================
// BFF Route: /api/ids/crm/customer-history
// Read-only GET endpoint for industrial-scoped Customer History list & charts.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { DirectusUpstreamError } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/services/customer-history.directus";
import { getCustomerHistoryList } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/services/customer-history.service";
import { parseListFiltersFromSearchParams } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/types/customer-history.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_FILTERS",
        message: error.issues[0]?.message ?? "Invalid filter parameters.",
      },
      { status: 400 }
    );
  }
  if (error instanceof DirectusUpstreamError) {
    console.error("[CustomerHistory] upstream error:", error.message);
    return NextResponse.json(
      {
        ok: false,
        code: "UPSTREAM_ERROR",
        message: "Unable to load customer history from Directus.",
      },
      { status: 502 }
    );
  }
  console.error("[CustomerHistory] unexpected error:", error);
  return NextResponse.json(
    {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Unexpected error loading customer history.",
    },
    { status: 500 }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const filters = parseListFiltersFromSearchParams(searchParams);
    const payload = await getCustomerHistoryList(filters, {
      signal: req.signal,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
