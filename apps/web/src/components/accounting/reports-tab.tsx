"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  formatCurrency,
} from "@/components/accounting/accounting-utils";
import { TaxFilingReport } from "@/components/accounting/tax-filing-report";
import { Badge } from "@/components/shared/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  type BalanceSheet,
  type CashFlow,
  getBalanceSheet,
  getCashFlow,
  getProfitAndLoss,
  getStatutoryReports,
  getTaxRegisters,
  getTaxReport,
  getTrialBalance,
  type ProfitAndLoss,
  type StatutoryReports,
  type TaxRegisters,
  type TaxSummary,
  type TrialBalance,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

type ReportKind =
  "tb" | "pnl" | "bs" | "cf" | "tax" | "tax-filing" | "statutory";

const REPORT_OPTIONS: { value: ReportKind; label: string; period: boolean }[] =
  [
    { value: "tb", label: "Trial Balance", period: false },
    { value: "pnl", label: "Profit & Loss", period: true },
    { value: "bs", label: "Balance Sheet", period: false },
    { value: "cf", label: "Cash Flow", period: true },
    { value: "tax", label: "VAT / WHT Summary", period: true },
    { value: "tax-filing", label: "Tax Filing (RD)", period: true },
    { value: "statutory", label: "Statutory control", period: true },
  ];

type Result =
  | { kind: "tb"; data: TrialBalance }
  | { kind: "pnl"; data: ProfitAndLoss }
  | { kind: "bs"; data: BalanceSheet }
  | { kind: "cf"; data: CashFlow }
  | { kind: "tax"; data: TaxSummary }
  | { kind: "tax-filing"; data: TaxRegisters }
  | { kind: "statutory"; data: StatutoryReports };

const todayIso = () => new Date().toISOString().slice(0, 10);
const yearStartIso = () => `${new Date().getFullYear()}-01-01`;

const inputClass =
  "border-border bg-surface h-10 rounded-md border px-2 text-xs";

interface ReportsTabProps {
  entities: Entity[];
}

export function ReportsTab({ entities }: ReportsTabProps) {
  const [entityId, setEntityId] = useState(ALL_FILTER);
  const [kind, setKind] = useState<ReportKind>("tb");
  const [asOf, setAsOf] = useState(todayIso());
  const [startDate, setStartDate] = useState(yearStartIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const isPeriod =
    REPORT_OPTIONS.find((o) => o.value === kind)?.period ?? false;
  const scopedEntityId = entityId === ALL_FILTER ? undefined : entityId;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (kind === "tax") {
        if (!scopedEntityId) {
          toast.error("Select an entity for the VAT / WHT summary");
          setResult(null);
          return;
        }
        const r = await getTaxReport({
          entityId: scopedEntityId,
          startDate,
          endDate,
        });
        setResult({ kind: "tax", data: r.data });
      } else if (kind === "tax-filing") {
        if (!scopedEntityId) {
          toast.error("Select an entity for tax filing");
          setResult(null);
          return;
        }
        const r = await getTaxRegisters({
          entityId: scopedEntityId,
          startDate,
          endDate,
        });
        setResult({ kind: "tax-filing", data: r.data });
      } else if (kind === "statutory") {
        if (!scopedEntityId) {
          toast.error("Select an entity for statutory control");
          setResult(null);
          return;
        }
        const r = await getStatutoryReports({
          entityId: scopedEntityId,
          startDate,
          endDate,
        });
        setResult({ kind: "statutory", data: r.data });
      } else if (kind === "tb") {
        const r = await getTrialBalance({ entityId: scopedEntityId, asOf });
        setResult({ kind: "tb", data: r.data });
      } else if (kind === "bs") {
        const r = await getBalanceSheet({ entityId: scopedEntityId, asOf });
        setResult({ kind: "bs", data: r.data });
      } else if (kind === "pnl") {
        const r = await getProfitAndLoss({
          entityId: scopedEntityId,
          startDate,
          endDate,
        });
        setResult({ kind: "pnl", data: r.data });
      } else {
        const r = await getCashFlow({
          entityId: scopedEntityId,
          startDate,
          endDate,
        });
        setResult({ kind: "cf", data: r.data });
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load report";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [kind, scopedEntityId, asOf, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border bg-surface flex flex-wrap items-center gap-2 rounded-lg
          border p-3 shadow-sm
        `}
      >
        <Select value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
          <SelectTrigger className="h-10 min-w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={entityId} onValueChange={setEntityId}>
          <SelectTrigger className="h-10 min-w-[150px] text-xs">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isPeriod ? (
          <>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="date"
              className={inputClass}
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date"
            />
          </>
        ) : (
          <input
            type="date"
            className={inputClass}
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            aria-label="As of date"
          />
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground p-4 text-sm">Loading report…</p>
      ) : result ? (
        <ReportView result={result} />
      ) : (
        <p className="text-muted-foreground p-4 text-sm">
          No report to display.
        </p>
      )}
    </div>
  );
}

function Money({ value }: { value: number }) {
  return (
    <span
      className={`
        tabular-nums
        ${value < 0 ? "text-red-600" : ""}
      `}
    >
      {formatCurrency(value)}
    </span>
  );
}

function Section({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { accountId: string; code: string; name: string; amount: number }[];
  total: number;
}) {
  return (
    <div className="border-border rounded-lg border">
      <div
        className={`
          border-border bg-surface border-b px-3 py-2 text-sm font-medium
        `}
      >
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountId} className="border-border/50 border-b">
              <td className="px-3 py-1.5">
                <span className="text-muted-foreground mr-2 font-mono text-xs">
                  {r.code}
                </span>
                {r.name}
              </td>
              <td className="px-3 py-1.5 text-right">
                <Money value={r.amount} />
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                className="text-muted-foreground px-3 py-1.5 text-xs"
                colSpan={2}
              >
                None
              </td>
            </tr>
          ) : null}
          <tr className="font-medium">
            <td className="px-3 py-2">Total {title}</td>
            <td className="px-3 py-2 text-right">
              <Money value={total} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: number }) {
  return (
    <div
      className={`
        border-border/50 flex items-center justify-between border-b py-1.5
      `}
    >
      <span className="text-muted-foreground text-sm">{label}</span>
      <Money value={value} />
    </div>
  );
}

function ReportView({ result }: { result: Result }) {
  if (result.kind === "tb") {
    const tb = result.data;
    return (
      <div className="border-border overflow-hidden rounded-lg border">
        <div
          className={`
            border-border bg-surface flex items-center justify-between border-b
            px-3 py-2
          `}
        >
          <span className="text-sm font-medium">
            Trial Balance · as of {tb.asOf}
          </span>
          <Badge status={tb.balanced ? "posted" : "overdue"}>
            {tb.balanced ? "Balanced" : "Unbalanced"}
          </Badge>
        </div>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-border border-b">
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {tb.rows.map((r) => (
              <tr key={r.accountId} className="border-border/50 border-b">
                <td className="px-3 py-1.5">
                  <span className="text-muted-foreground mr-2 font-mono text-xs">
                    {r.code}
                  </span>
                  {r.name}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {r.debit ? formatCurrency(r.debit) : ""}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {r.credit ? formatCurrency(r.credit) : ""}
                </td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(tb.totalDebit)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(tb.totalCredit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (result.kind === "pnl") {
    const pnl = result.data;
    return (
      <div className="flex flex-col gap-3">
        <Section title="Revenue" rows={pnl.revenue} total={pnl.totalRevenue} />
        <Section
          title="Expenses"
          rows={pnl.expenses}
          total={pnl.totalExpenses}
        />
        <div
          className={`
            border-border bg-surface flex items-center justify-between
            rounded-lg border p-3 text-sm font-medium
          `}
        >
          <span>
            Net Profit · {pnl.startDate} – {pnl.endDate}
          </span>
          <Money value={pnl.netProfit} />
        </div>
      </div>
    );
  }

  if (result.kind === "bs") {
    const bs = result.data;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Balance Sheet · as of {bs.asOf}
          </span>
          <Badge status={bs.balanced ? "posted" : "overdue"}>
            {bs.balanced
              ? "Balanced"
              : `Off by ${formatCurrency(bs.difference)}`}
          </Badge>
        </div>
        <Section title="Assets" rows={bs.assets} total={bs.totalAssets} />
        <Section
          title="Liabilities"
          rows={bs.liabilities}
          total={bs.totalLiabilities}
        />
        <Section title="Equity" rows={bs.equity} total={bs.totalEquity} />
        <div
          className={`
            border-border bg-surface flex items-center justify-between
            rounded-lg border p-3 text-sm font-medium
          `}
        >
          <span>Total Liabilities + Equity</span>
          <Money value={bs.totalLiabilitiesAndEquity} />
        </div>
      </div>
    );
  }

  if (result.kind === "cf") {
    const cf = result.data;
    return (
      <div
        className={`
          border-border bg-surface flex flex-col gap-1 rounded-lg border p-3
        `}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium">
            Cash Flow · {cf.startDate} – {cf.endDate}
          </span>
          <Badge status={cf.reconciles ? "posted" : "overdue"}>
            {cf.reconciles ? "Reconciles" : "Does not reconcile"}
          </Badge>
        </div>
        <KeyVal label="Opening cash" value={cf.openingCash} />
        <KeyVal label="Operating" value={cf.operating} />
        <KeyVal label="Investing" value={cf.investing} />
        <KeyVal label="Financing" value={cf.financing} />
        <KeyVal label="Net change" value={cf.netChange} />
        <KeyVal label="Closing cash" value={cf.closingCash} />
        <p className="text-muted-foreground mt-2 text-xs">{cf.note}</p>
      </div>
    );
  }

  if (result.kind === "tax-filing") {
    return <TaxFilingReport data={result.data} />;
  }

  if (result.kind === "statutory") {
    const s = result.data;
    return (
      <div
        className={`
          border-border bg-surface flex flex-col gap-3 rounded-lg border p-3
          text-sm
        `}
      >
        <span className="font-medium">
          Statutory control · {s.startDate} – {s.endDate}
        </span>
        {(["je", "inv", "rcp", "exp"] as const).map((key) => {
          const block = s.numberControl[key];
          if (!block) return null;
          return (
            <div key={key}>
              <p className="text-xs font-semibold uppercase">{key}</p>
              <p className="text-muted-foreground text-xs">
                {block.first ?? "—"} → {block.last ?? "—"} · issued{" "}
                {block.issuedCount} · cancelled {block.cancelledCount} · gaps{" "}
                {block.gaps.length}
              </p>
              {block.gaps.length > 0 ? (
                <p className="text-xs">
                  {block.gaps
                    .slice(0, 12)
                    .map((g) => `${g.expected} (${g.reason})`)
                    .join(", ")}
                </p>
              ) : null}
            </div>
          );
        })}
        <div>
          <p className="text-xs font-semibold uppercase">
            Deferred output VAT vs collections
          </p>
          <KeyVal
            label="Issued deferred"
            value={s.deferredVatRecon.issuedDeferredVat}
          />
          <KeyVal
            label="Recognised on collection"
            value={s.deferredVatRecon.collectedRecognisedVat}
          />
          <KeyVal
            label="Still deferred"
            value={s.deferredVatRecon.remainingDeferredVat}
          />
          <KeyVal
            label="Recon difference"
            value={s.deferredVatRecon.reconDifference}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase">
            Pending WHT certificates
          </p>
          {s.pendingWhtCertificates.length === 0 ? (
            <p className="text-muted-foreground text-xs">None</p>
          ) : (
            s.pendingWhtCertificates.map((row) => (
              <p key={row.paymentId} className="text-xs">
                {row.date} · {row.invoiceNo} · {row.counterparty} ·{" "}
                {formatCurrency(row.whtAmount)}
              </p>
            ))
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase">
            Posted JEs with zero attachments
          </p>
          <p className="text-xs">
            {s.zeroAttachmentJournals.length === 0
              ? "None"
              : s.zeroAttachmentJournals.join(", ")}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase">
            Attachment deletions
          </p>
          {s.attachmentDeletions.length === 0 ? (
            <p className="text-muted-foreground text-xs">None in range</p>
          ) : (
            s.attachmentDeletions.map((row) => (
              <p key={row.id} className="text-xs">
                {row.deletedAt?.slice(0, 10)} · {row.originalName} ·{" "}
                {row.linkedTo}/{row.linkedId}
              </p>
            ))
          )}
        </div>
      </div>
    );
  }

  const tax = result.data;
  return (
    <div
      className={`
        border-border bg-surface flex flex-col gap-1 rounded-lg border p-3
      `}
    >
      <span className="mb-1 text-sm font-medium">
        VAT / WHT Summary · {tax.startDate} – {tax.endDate}
      </span>
      <KeyVal label="Output VAT (sales)" value={tax.outputVat} />
      <KeyVal label="Input VAT (purchases)" value={tax.inputVat} />
      <KeyVal label="Net VAT payable" value={tax.netVatPayable} />
      <KeyVal label="WHT payable (to Revenue Dept)" value={tax.whtPayable} />
      <KeyVal label="WHT receivable" value={tax.whtReceivable} />
      <p className="text-muted-foreground mt-2 text-xs">{tax.note}</p>
    </div>
  );
}
