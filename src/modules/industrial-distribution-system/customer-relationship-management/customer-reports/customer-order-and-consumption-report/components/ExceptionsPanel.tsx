// src/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/components/ExceptionsPanel.tsx
// ============================================================
// Data Exceptions & Quality Audit Panel.
// Surfaced business and master data anomalies.
// ============================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import { formatKgCompact, formatQty } from "../services/customer-order-consumption.helpers";
import type { ExceptionCode} from "../types/customer-order-consumption.types";

function SeverityBadge({ code }: { code: ExceptionCode }) {
  if (code === "RETURN_EXCEEDS_FULFILLED") {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0">
        <AlertCircle className="size-3" />
        Critical
      </Badge>
    );
  }
  if (code === "LPG_VARIANCE" || code === "UNFULFILLED_DELIVERY" || code === "MISSING_PRODUCT_WEIGHT") {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700">
        <AlertTriangle className="size-3 text-amber-600" />
        Warning
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
      <Info className="size-3 text-muted-foreground" />
      Advisory
    </Badge>
  );
}

export function ExceptionsPanel(): React.ReactElement {
  const { report } = useCustomerOrderConsumptionReport();
  const exceptions = report?.exceptions ?? [];

  return (
    <Card className="shadow-none border bg-card">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-24 text-xs font-semibold">Severity</TableHead>
                <TableHead className="text-xs font-semibold">Exception Type</TableHead>
                <TableHead className="text-xs font-semibold">Channel</TableHead>
                <TableHead className="text-xs font-semibold">Customer</TableHead>
                <TableHead className="text-xs font-semibold">Reference</TableHead>
                <TableHead className="text-xs font-semibold">Details &amp; Audit Advisory</TableHead>
                <TableHead className="text-xs font-semibold text-right">Units</TableHead>
                <TableHead className="text-xs font-semibold text-right">Weight (Kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map((e, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, delay: Math.min(index * 0.03, 0.3) }}
                  className="hover:bg-muted/20 border-b border-border/40 transition-colors"
                >
                  <TableCell className="py-2">
                    <SeverityBadge code={e.code} />
                  </TableCell>
                  <TableCell className="py-2 text-xs font-mono font-medium">
                    {e.code}
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {e.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <div className="font-medium truncate max-w-[150px]">{e.customerName}</div>
                    <div className="text-[10px] text-muted-foreground">{e.customerCode}</div>
                  </TableCell>
                  <TableCell className="py-2 text-xs font-mono">
                    {e.referenceType}: {e.referenceNo}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground max-w-sm">
                    {e.detail}
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums">
                    {e.quantity > 0 ? formatQty(e.quantity) : "—"}
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums font-medium">
                    {e.kg > 0 ? formatKgCompact(e.kg) : "—"}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
