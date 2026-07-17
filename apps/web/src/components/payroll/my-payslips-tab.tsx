"use client";

import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  downloadMyGeneratedPayslip,
  getMyPayslipDownloadUrl,
  listMyPayslips,
  type MyPayslip,
} from "@/services/payroll.service";

// Statuses where the employee may pull the generated payslip
// document. `draft` runs aren't HR-blessed yet, so numbers can still
// move — keep them hidden behind a "Pending HR approval" message.
const RELEASED_STATUSES = new Set(["approved", "paid"]);

function formatPeriod(yyyyMm: string): string {
  // Period stored as "2026-01"; render "January 2026" so the column
  // reads naturally for employees who don't think in zero-padded dates.
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!match) return yyyyMm;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11) return yyyyMm;
  const date = new Date(Date.UTC(year, monthIdx, 1));
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCurrency(value: string, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export function MyPayslipsTab() {
  const [rows, setRows] = useState<MyPayslip[]>([]);
  const [loading, setLoading] = useState(true);
  // `downloading` keys are `${slipId}:${variant}` so each button on a
  // row can spin independently — clicking PDF doesn't grey out Excel.
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listMyPayslips();
      setRows(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load payslips";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function handleUploadedDownload(slip: MyPayslip) {
    if (!slip.documentUrl) return;
    const key = `${slip.id}:uploaded`;
    try {
      setDownloading(key);
      const res = await getMyPayslipDownloadUrl(slip.id);
      // New tab so the browser handles PDF preview / save per its own
      // settings — same UX as the HRMS agreement download button.
      const win = window.open(res.data.url, "_blank");
      if (win) win.opener = null;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to fetch download URL";
      toast.error(msg);
    } finally {
      setDownloading(null);
    }
  }

  async function handleGeneratedDownload(
    slip: MyPayslip,
    format: "pdf" | "xlsx",
  ) {
    const key = `${slip.id}:${format}`;
    try {
      setDownloading(key);
      await downloadMyGeneratedPayslip(slip.id, format);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate payslip";
      toast.error(msg);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border/80 bg-card/85 mb-1 flex flex-col gap-1 rounded-xl border
          p-4 shadow-sm backdrop-blur-sm
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground size-4" />
          <span className="text-foreground text-sm font-medium">
            My payslips
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Download your payroll PDFs once HR attaches them. Net &amp; gross
          values mirror the run detail.
        </p>
      </div>

      <div
        className={`
          border-border/70 bg-muted/20 flex items-start gap-2 rounded-lg border
          px-3 py-2.5 text-xs
        `}
      >
        <Lock className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
        <p className="text-muted-foreground">
          Downloaded payslip files are password-protected. The password is your{" "}
          <span className="text-foreground font-medium">
            date of birth as DDMMYYYY
          </span>{" "}
          (e.g. 31 Oct 1998 → <span className="font-mono">31101998</span>). If
          your date of birth isn&apos;t on file the file won&apos;t be protected
          — ask HR to add it.
        </p>
      </div>

      <div
        className={`
          border-border/60 bg-muted/15 overflow-hidden rounded-xl border
          shadow-sm
        `}
      >
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Period</th>
              <th className="px-3 py-2 text-left font-medium">Entity</th>
              <th className="px-3 py-2 text-right font-medium">Gross</th>
              <th className="px-3 py-2 text-right font-medium">Net</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Document</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground py-12 text-center"
                >
                  <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground py-12 text-center"
                >
                  No payslips on file yet.
                </td>
              </tr>
            ) : (
              rows.map((slip) => (
                <tr key={slip.id} className="border-border/50 border-t">
                  <td className="px-3 py-2 font-medium">
                    {formatPeriod(slip.payrollRun.period)}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {slip.payrollRun.entity.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(slip.grossPay, slip.currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(slip.netPay, slip.currency)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge status={slip.payrollRun.status}>
                      {slip.payrollRun.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {RELEASED_STATUSES.has(slip.payrollRun.status) ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            void handleGeneratedDownload(slip, "pdf")
                          }
                          disabled={downloading === `${slip.id}:pdf`}
                          title="Download PDF"
                        >
                          {downloading === `${slip.id}:pdf` ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <FileText className="size-3.5" />
                          )}
                          PDF
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            void handleGeneratedDownload(slip, "xlsx")
                          }
                          disabled={downloading === `${slip.id}:xlsx`}
                          title="Download Excel"
                        >
                          {downloading === `${slip.id}:xlsx` ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="size-3.5" />
                          )}
                          Excel
                        </Button>
                        {slip.documentUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void handleUploadedDownload(slip)}
                            disabled={downloading === `${slip.id}:uploaded`}
                            title="HR-uploaded copy"
                          >
                            {downloading === `${slip.id}:uploaded` ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">
                        Pending HR approval
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
