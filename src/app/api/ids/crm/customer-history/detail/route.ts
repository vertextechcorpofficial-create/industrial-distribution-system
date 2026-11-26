// ============================================================================
// BFF Route: /api/ids/crm/customer-history/detail
// Read-only GET endpoint for a single customer's full industrial history.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { DirectusUpstreamError } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/services/customer-history.directus";
import { getCustomerHistoryDetail } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/services/customer-history.service";
import { customerHistoryDetailSchema } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-management/customer-history/types/customer-history.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = customerHistoryDetailSchema.parse({
      customerCode: searchParams.get("customerCode") ?? "",
      range: searchParams.get("range") ?? undefined,
    });

    const detail = await getCustomerHistoryDetail(
      parsed.customerCode,
      parsed.range,
      { signal: req.signal }
    );

    if (!detail) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Customer not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PARAMS",
          message: error.issues[0]?.message ?? "Invalid detail parameters.",
        },
        { status: 400 }
      );
    }
    if (error instanceof DirectusUpstreamError) {
      console.error("[CustomerHistoryDetail] upstream error:", error.message);
      return NextResponse.json(
        {
          ok: false,
          code: "UPSTREAM_ERROR",
          message: "Unable to load customer detail from Directus.",
        },
        { status: 502 }
      );
    }
    console.error("[CustomerHistoryDetail] unexpected error:", error);
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Unexpected error loading customer detail.",
      },
      { status: 500 }
    );
  }
}
