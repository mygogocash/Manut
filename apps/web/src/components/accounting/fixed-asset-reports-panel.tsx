"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@/components/accounting/accounting-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  type FixedAssetDisposalReport,
  type FixedAssetMovementReport,
  type FixedAssetRegisterReport,
  type FixedAssetScheduleReport,
  getFixedAssetDepreciationSchedule,
  getFixedAssetDisposalReport,
  getFixedAssetMovementReport,
  getFixedAssetRegisterReport,
} from "@/services/accounting.service";

type ReportType = "register" | "schedule" | "disposals" | "movement";

const REPORT_LABELS: Record<ReportType, string> = {
  register: "Fixed Asset Report",
  schedule: "Monthly depreciation schedule",
  disposals: "Disposal / write-off report",
  movement: "Movement report",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

const num = (n: number) => (
  <span className="tabular-nums">{formatCurrency(n)}</span>
);

interface Props {
  entityId: string;
}

export function FixedAssetReportsPanel({ entityId }: Props) {
  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>("register");
  const [asOf, setAsOf] = useState(todayIso());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(todayIso());
  const [loading, setLoading] = useState(false);

  const [register, setRegister] = useState<FixedAssetRegisterReport | null>(
    null,
  );
  const [schedule, setSchedule] = useState<FixedAssetScheduleReport | null>(
    null,
  );
  const [disposals, setDisposals] = useState<FixedAssetDisposalReport | null>(
    null,
  );
  const [movement, setMovement] = useState<FixedAssetMovementReport | null>(
    null,
  );

  async function run() {
    if (!entityId) return;
    setLoading(true);
    try {
      if (reportType === "register") {
        setRegister(
          (await getFixedAssetRegisterReport({ entityId, asOf })).data,
        );
      } else if (reportType === "schedule") {
        setSchedule(
          (await getFixedAssetDepreciationSchedule({ entityId, year, month }))
            .data,
        );
      } else if (reportType === "disposals") {
        setDisposals(
          (await getFixedAssetDisposalReport({ entityId, from, to })).data,
        );
      } else {
        setMovement(
          (await getFixedAssetMovementReport({ entityId, from, to })).data,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to run report",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={`
          border-border flex flex-col gap-2 border-b px-5 py-3
          md:flex-row md:items-center
        `}
      >
        <p
          className={`
            text-muted-foreground text-[10px] font-semibold tracking-wider
            uppercase
          `}
        >
          Reports
        </p>
        <div
          className={`
            flex flex-col gap-2
            md:ml-auto md:flex-row md:items-center
          `}
        >
          <Select
            value={reportType}
            onValueChange={(v) => setReportType(v as ReportType)}
          >
            <SelectTrigger className="h-9 min-w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REPORT_LABELS) as ReportType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {REPORT_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {reportType === "register" ? (
            <Input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="h-9 text-xs"
            />
          ) : null}

          {reportType === "schedule" ? (
            <div className="flex gap-2">
              <Input
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 w-24 text-xs"
              />
              <Input
                type="number"
                min="1"
                max="12"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-9 w-20 text-xs"
              />
            </div>
          ) : null}

          {reportType === "disposals" || reportType === "movement" ? (
            <div className="flex gap-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 text-xs"
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          ) : null}

          <Button size="sm" onClick={() => void run()} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Run
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto p-5 text-sm">
        {reportType === "register" && register ? (
          <RegisterView r={register} />
        ) : null}
        {reportType === "schedule" && schedule ? (
          <ScheduleView r={schedule} />
        ) : null}
        {reportType === "disposals" && disposals ? (
          <DisposalsView r={disposals} />
        ) : null}
        {reportType === "movement" && movement ? (
          <MovementView r={movement} />
        ) : null}
      </div>
    </section>
  );
}

const th = "text-muted-foreground px-2 py-1 text-left text-xs font-medium";
const thr = "text-muted-foreground px-2 py-1 text-right text-xs font-medium";
const td = "px-2 py-1";
const tdr = "px-2 py-1 text-right tabular-nums";
const subtotalRow = "border-border border-t font-medium";

function RegisterView({ r }: { r: FixedAssetRegisterReport }) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-xs">As at {r.asOf}</p>
      {r.groups.map((g) => (
        <table key={g.categoryCode} className="w-full">
          <thead>
            <tr>
              <th className={th} colSpan={2}>
                {g.categoryCode}
              </th>
              <th className={thr}>Qty</th>
              <th className={thr}>Cost</th>
              <th className={thr}>Accum. dep.</th>
              <th className={thr}>NBV</th>
            </tr>
          </thead>
          <tbody>
            {g.rows.map((row) => (
              <tr key={row.assetNo} className="border-border/50 border-t">
                <td className={td}>{row.assetNo}</td>
                <td className={td}>{row.name}</td>
                <td className={tdr}>{row.quantity}</td>
                <td className={tdr}>{num(row.cost)}</td>
                <td className={tdr}>{num(row.accumulatedDepreciation)}</td>
                <td className={tdr}>{num(row.netBookValue)}</td>
              </tr>
            ))}
            <tr className={subtotalRow}>
              <td className={td} colSpan={3}>
                Subtotal
              </td>
              <td className={tdr}>{num(g.subtotal.cost)}</td>
              <td className={tdr}>{num(g.subtotal.accumulatedDepreciation)}</td>
              <td className={tdr}>{num(g.subtotal.netBookValue)}</td>
            </tr>
          </tbody>
        </table>
      ))}
      <table className="w-full">
        <tbody>
          <tr className="border-border border-t font-medium">
            <td className={td}>Total asset using</td>
            <td className={tdr}>{num(r.usingTotal.netBookValue)}</td>
          </tr>
          <tr className="font-medium">
            <td className={td}>Total asset not using</td>
            <td className={tdr}>{num(r.notUsingTotal.netBookValue)}</td>
          </tr>
          <tr className="border-border border-t font-medium">
            <td className={td}>Grand total NBV</td>
            <td className={tdr}>{num(r.grandTotal.netBookValue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ScheduleView({ r }: { r: FixedAssetScheduleReport }) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-xs">Period {r.period}</p>
      {r.groups.map((g) => (
        <table key={g.categoryCode} className="w-full">
          <thead>
            <tr>
              <th className={th} colSpan={2}>
                {g.categoryCode}
              </th>
              <th className={thr}>Opening NBV</th>
              <th className={thr}>Depreciation</th>
              <th className={thr}>Closing NBV</th>
            </tr>
          </thead>
          <tbody>
            {g.rows.map((row) => (
              <tr key={row.assetNo} className="border-border/50 border-t">
                <td className={td}>{row.assetNo}</td>
                <td className={td}>{row.name}</td>
                <td className={tdr}>{num(row.openingNbv)}</td>
                <td className={tdr}>{num(row.depreciation)}</td>
                <td className={tdr}>{num(row.closingNbv)}</td>
              </tr>
            ))}
            <tr className={subtotalRow}>
              <td className={td} colSpan={2}>
                Subtotal
              </td>
              <td className={tdr}>{num(g.subtotal.openingNbv)}</td>
              <td className={tdr}>{num(g.subtotal.depreciation)}</td>
              <td className={tdr}>{num(g.subtotal.closingNbv)}</td>
            </tr>
          </tbody>
        </table>
      ))}
      <table className="w-full font-medium">
        <tbody>
          <tr className="border-border border-t">
            <td className={td}>Total depreciation to post</td>
            <td className={tdr}>{num(r.total.depreciation)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DisposalsView({ r }: { r: FixedAssetDisposalReport }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className={th}>Asset</th>
          <th className={th}>Date</th>
          <th className={th}>Type</th>
          <th className={thr}>Proceeds</th>
          <th className={thr}>NBV disposed</th>
          <th className={thr}>Gain / (loss)</th>
        </tr>
      </thead>
      <tbody>
        {r.rows.map((row) => (
          <tr
            key={`${row.assetNo}-${row.disposalDate}`}
            className="border-border/50 border-t"
          >
            <td className={td}>
              {row.assetNo} — {row.name}
            </td>
            <td className={td}>{row.disposalDate}</td>
            <td
              className={`
                ${td}
                capitalize
              `}
            >
              {row.disposalType.replace("_", " ")}
            </td>
            <td className={tdr}>{num(row.proceeds)}</td>
            <td className={tdr}>{num(row.nbvDisposed)}</td>
            <td className={tdr}>{num(row.gainLoss)}</td>
          </tr>
        ))}
        <tr className={subtotalRow}>
          <td className={td} colSpan={3}>
            Total
          </td>
          <td className={tdr}>{num(r.total.proceeds)}</td>
          <td className={tdr}>{num(r.total.nbvDisposed)}</td>
          <td className={tdr}>{num(r.total.gainLoss)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function MovementView({ r }: { r: FixedAssetMovementReport }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className={th}>Category</th>
          <th className={thr}>Opening</th>
          <th className={thr}>Additions</th>
          <th className={thr}>Disposals</th>
          <th className={thr}>Depreciation</th>
          <th className={thr}>Closing</th>
        </tr>
      </thead>
      <tbody>
        {r.rows.map((row) => (
          <tr key={row.categoryCode} className="border-border/50 border-t">
            <td className={td}>{row.categoryCode}</td>
            <td className={tdr}>{num(row.opening)}</td>
            <td className={tdr}>{num(row.additions)}</td>
            <td className={tdr}>{num(row.disposals)}</td>
            <td className={tdr}>{num(row.depreciation)}</td>
            <td className={tdr}>{num(row.closing)}</td>
          </tr>
        ))}
        <tr className={subtotalRow}>
          <td className={td}>Total</td>
          <td className={tdr}>{num(r.total.opening)}</td>
          <td className={tdr}>{num(r.total.additions)}</td>
          <td className={tdr}>{num(r.total.disposals)}</td>
          <td className={tdr}>{num(r.total.depreciation)}</td>
          <td className={tdr}>{num(r.total.closing)}</td>
        </tr>
      </tbody>
    </table>
  );
}
