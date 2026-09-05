"use client";

import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { InvoicePrint } from "@/components/accounting/invoice-print";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  downloadInvoiceDocx,
  downloadInvoicePdf,
  downloadInvoiceXlsx,
  getInvoice,
  getInvoiceCompany,
  type Invoice,
  INVOICE_STATUSES,
  type InvoiceCompany,
  type InvoiceStatus,
  updateInvoiceStatus,
} from "@/services/accounting.service";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

// Print isolation: the invoice lives inside the (dashboard) shell (sidebar +
// header). At print time hide everything, then re-reveal only the invoice and
// pin it to the top-left of the page. `.no-print` drops the toolbar buttons.
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  .invoice-print, .invoice-print * { visibility: visible !important; }
  .invoice-print {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
  .no-print { display: none !important; }
  @page { margin: 12mm; }
}
`;

export default function InvoicePrintPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { hasPermission } = useAuth();
  const canEditStatus = hasPermission("accounting:create");

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<InvoiceCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError(null);
    Promise.all([getInvoice(id), getInvoiceCompany()])
      .then(([inv, comp]) => {
        if (cancelled) return;
        setInvoice(inv.data);
        setCompany(comp.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        const msg =
          err instanceof ApiError ? err.message : "Failed to load invoice";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleStatusChange = useCallback(
    async (next: string) => {
      if (!invoice || next === invoice.status) return;
      setSavingStatus(true);
      try {
        const res = await updateInvoiceStatus(id, next as InvoiceStatus);
        setInvoice(res.data);
        toast.success(
          `Status updated to ${STATUS_LABELS[next as InvoiceStatus] ?? next}`,
        );
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to update status";
        toast.error(msg);
      } finally {
        setSavingStatus(false);
      }
    },
    [id, invoice],
  );

  const handleDownload = useCallback(
    async (kind: "pdf" | "docx" | "xlsx") => {
      try {
        if (kind === "pdf") await downloadInvoicePdf(id);
        else if (kind === "docx") await downloadInvoiceDocx(id);
        else await downloadInvoiceXlsx(id);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : `Failed to download ${kind.toUpperCase()}`;
        toast.error(msg);
      }
    },
    [id],
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton
          className={`mx-auto h-[600px] w-full max-w-[800px] rounded-md`}
        />
      </div>
    );
  }

  if (notFound || error || !invoice || !company) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center gap-4">
        <FileWarning className="text-muted-foreground size-10" />
        <p className="text-foreground text-base font-medium">
          {error ?? "Invoice not found"}
        </p>
        <p className="text-muted-foreground max-w-md text-center text-sm">
          This invoice may have been deleted, or you may not have permission to
          view it.
        </p>
        <Button variant="outline" asChild>
          <Link href="/accounting?tab=invoices">
            <ArrowLeft className="size-3.5" /> Back to Accounting
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div
        className={`no-print flex flex-wrap items-center justify-between gap-3`}
      >
        <Button variant="ghost" asChild>
          <Link href="/accounting?tab=invoices">
            <ArrowLeft className="size-3.5" /> Back
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`
              text-muted-foreground text-[10px] font-bold tracking-widest
              uppercase
            `}
          >
            Status
          </span>
          {canEditStatus ? (
            <Select
              value={invoice.status}
              onValueChange={(v) => void handleStatusChange(v)}
              disabled={savingStatus}
            >
              <SelectTrigger className="h-9 min-w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge status={invoice.status}>
              {STATUS_LABELS[invoice.status as InvoiceStatus] ?? invoice.status}
            </Badge>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleDownload("pdf")}
          >
            <FileText className="size-3.5" /> PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleDownload("docx")}
          >
            <FileText className="size-3.5" /> Word
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleDownload("xlsx")}
          >
            <FileSpreadsheet className="size-3.5" /> Excel
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <div
        className={`
          invoice-print rounded-lg border border-neutral-200 shadow-sm
        `}
      >
        <InvoicePrint invoice={invoice} company={company} />
      </div>
    </div>
  );
}
