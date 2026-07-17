"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EsopPoolCards } from "@/components/hrms/esop-pool-cards";
import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  ESOP_GRANT_TYPE_LABELS,
  type EsopEmployeeSummary,
  type EsopGrantType,
  getEsopEmployeeSummary,
} from "@/services/hrms.service";

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function fmtMonth(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

export default function EsopEmployeePage() {
  const router = useRouter();
  const params = useParams<{ employeeId: string }>();
  const employeeId = params?.employeeId ?? "";

  const [summary, setSummary] = useState<EsopEmployeeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const res = await getEsopEmployeeSummary(employeeId);
      setSummary(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load ESOP summary";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <div
        className={`
          text-muted-foreground flex items-center justify-center gap-2 py-24
          text-sm
        `}
      >
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" onClick={() => router.push("/hrms")}>
          <ArrowLeft className="mr-1 size-3.5" /> Back to HRMS
        </Button>
        <p className="text-muted-foreground py-12 text-center text-sm">
          No ESOP summary available.
        </p>
      </div>
    );
  }

  const { employee, kpis, instruments } = summary;
  const vesting = instruments.filter((i) => i.scheduled);
  const vested = instruments.filter((i) => !i.scheduled);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={employee.name}
        subtitle={`ESOP breakdown${employee.department ? ` · ${employee.department}` : ""}`}
      >
        <Button variant="outline" onClick={() => router.push("/hrms")}>
          <ArrowLeft className="mr-1 size-3.5" /> Back to HRMS
        </Button>
      </PageHeader>

      <EsopPoolCards pool={kpis} loading={false} />

      {instruments.length === 0 ? (
        <p
          className={`
            text-muted-foreground rounded-md border border-dashed py-12
            text-center text-sm
          `}
        >
          No ESOP grants for this employee.
        </p>
      ) : (
        <div className="bg-card overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr className="text-muted-foreground text-[11px] uppercase">
                <th className="px-3 py-2 font-medium">Instrument</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Shares</th>
                <th className="px-3 py-2 font-medium">Vesting period</th>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">
                  Vesting to date
                </th>
                <th className="px-3 py-2 text-right font-medium">% vested</th>
              </tr>
            </thead>
            <tbody>
              {[...vesting, ...vested].map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2">
                    {ESOP_GRANT_TYPE_LABELS[i.grantType as EsopGrantType] ??
                      i.grantType}
                  </td>
                  <td className="px-3 py-2">
                    {i.scheduled ? (
                      <Badge status="active">Vesting</Badge>
                    ) : (
                      <Badge status="exercised">Vested</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(i.shares)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {i.vestingMonths ? `${i.vestingMonths}mo` : "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {i.scheduled
                      ? `${fmtMonth(i.allocationStartMonth ?? i.grantDate)} → ${fmtMonth(i.allocationEndMonth)}`
                      : fmtMonth(i.grantDate)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {i.scheduled ? fmtNum(i.vestedToDate) : "—"}
                  </td>
                  <td
                    className={`
                      text-muted-foreground px-3 py-2 text-right tabular-nums
                    `}
                  >
                    {i.scheduled ? pct(i.vestedToDate, i.shares) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Grand Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtNum(kpis.grandTotal)}
                </td>
                <td className="px-3 py-2" colSpan={2} />
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtNum(kpis.vestedToDate)}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
