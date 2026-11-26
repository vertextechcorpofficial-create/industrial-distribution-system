// ============================================================================
// BFF Route: /api/ids/crm/customer-history/lookups
// Returns industrial-scoped branch and parent serialized product options.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { DirectusUpstreamError } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/services/customer-history.directus";
import { getCustomerHistoryLookups } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/services/customer-history.service";
import { customerHistoryLookupsSchema } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/types/customer-history.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = customerHistoryLookupsSchema.parse({
      type: searchParams.get("type") ?? "",
      q: searchParams.get("q") ?? undefined,
    });

    const options = await getCustomerHistoryLookups(parsed.type, parsed.q, {
      signal: req.signal,
    });

    return NextResponse.json({ ok: true, options });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PARAMS",
          message: error.issues[0]?.message ?? "Invalid lookup parameters.",
        },
        { status: 400 }
      );
    }
    if (error instanceof DirectusUpstreamError) {
      console.error("[CustomerHistoryLookups] upstream error:", error.message);
      return NextResponse.json(
        {
          ok: false,
          code: "UPSTREAM_ERROR",
          message: "Unable to load lookup options.",
        },
        { status: 502 }
      );
    }
    console.error("[CustomerHistoryLookups] unexpected error:", error);
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Unexpected error loading lookups.",
      },
      { status: 500 }
    );
  }
}
