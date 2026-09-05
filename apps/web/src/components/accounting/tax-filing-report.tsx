"use client";

import { Download } from "lucide-react";

import { formatCurrency } from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import type {
  TaxRegisters,
  VatRegister,
  WhtReturn,
} from "@/services/accounting.service";

// Client-side CSV download — dependency-free (no xlsx), quotes every cell so
// commas/quotes in names never break the columns. Opens straight into Excel.
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function num(n: number) {
  return (
    <span
      className={`
        tabular-nums
        ${n < 0 ? "text-red-600" : ""}
      `}
    >
      {formatCurrency(n)}
    </span>
  );
}

function VatRegisterCard({
  title,
  register,
  partyLabel,
  filenameStem,
  period,
}: {
  title: string;
  register: VatRegister;
  partyLabel: string;
  filenameStem: string;
  period: string;
}) {
  const onExport = () =>
    downloadCsv(`${filenameStem}-${period}.csv`, [
      ["Seq", "Date", "Document No", partyLabel, "Tax ID", "Branch", "Currency", "Net (base)", "VAT (base)"],
      ...register.rows.map((r) => [
        r.seq,
        r.date,
        r.docNo,
        r.counterparty,
        r.taxId,
        r.branch,
        r.currency,
        r.base,
        r.vat,
      ]),
      ["", "", "", "", "", "", "Total", register.totalBase, register.totalVat],
    ]);

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div
        className={`
          border-border bg-surface flex items-center justify-between border-b
          px-3 py-2
        `}
      >
        <span className="text-sm font-medium">{title}</span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={onExport}
          disabled={register.rows.length === 0}
        >
          <Download className="mr-1 size-3" />
          CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-border border-b">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Document</th>
              <th className="px-3 py-2 text-left">{partyLabel}</th>
              <th className="px-3 py-2 text-left">Tax ID</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2 text-right">VAT</th>
            </tr>
          </thead>
          <tbody>
            {register.rows.map((r) => (
              <tr key={r.docNo} className="border-border/50 border-b">
                <td className="text-muted-foreground px-3 py-1.5">{r.seq}</td>
                <td className="px-3 py-1.5">{r.date}</td>
                <td className="px-3 py-1.5">
                  {r.docNo}
                  {r.currency !== "THB" ? (
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({r.currency} @{r.exchangeRate})
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">{r.counterparty}</td>
                <td className="text-muted-foreground px-3 py-1.5 font-mono text-xs">
                  {r.taxId || "—"}
                  {r.zeroRatedOrExempt ? (
                    <span className="ml-1">· 0%</span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 text-right">{num(r.base)}</td>
                <td className="px-3 py-1.5 text-right">{num(r.vat)}</td>
              </tr>
            ))}
            {register.rows.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-2 text-xs"
                  colSpan={7}
                >
                  No documents in this period.
                </td>
              </tr>
            ) : null}
            <tr className="font-medium">
              <td className="px-3 py-2" colSpan={5}>
                Total
              </td>
              <td className="px-3 py-2 text-right">{num(register.totalBase)}</td>
              <td className="px-3 py-2 text-right">{num(register.totalVat)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WhtReturnCard({
  ret,
  subtitle,
  period,
}: {
  ret: WhtReturn;
  subtitle: string;
  period: string;
}) {
  const onExport = () =>
    downloadCsv(`${ret.form.replace(".", "")}-${period}.csv`, [
      ["Payee", "Tax ID", "Payments", "Income (base)", "WHT (base)"],
      ...ret.payees.map((p) => [
        p.payee,
        p.taxId,
        p.count,
        p.base,
        p.whtAmount,
      ]),
      ["Total", "", "", ret.totalBase, ret.totalWht],
    ]);

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div
        className={`
          border-border bg-surface flex items-center justify-between border-b
          px-3 py-2
        `}
      >
        <span className="text-sm font-medium">
          {ret.form}
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            {subtitle}
          </span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={onExport}
          disabled={ret.payees.length === 0}
        >
          <Download className="mr-1 size-3" />
          CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-border border-b">
              <th className="px-3 py-2 text-left">Payee</th>
              <th className="px-3 py-2 text-left">Tax ID</th>
              <th className="px-3 py-2 text-right">Income</th>
              <th className="px-3 py-2 text-right">WHT</th>
            </tr>
          </thead>
          <tbody>
            {ret.payees.map((p) => (
              <tr key={p.payeeId} className="border-border/50 border-b">
                <td className="px-3 py-1.5">{p.payee}</td>
                <td className="text-muted-foreground px-3 py-1.5 font-mono text-xs">
                  {p.taxId || "—"}
                </td>
                <td className="px-3 py-1.5 text-right">{num(p.base)}</td>
                <td className="px-3 py-1.5 text-right">{num(p.whtAmount)}</td>
              </tr>
            ))}
            {ret.payees.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-2 text-xs"
                  colSpan={4}
                >
                  No withholding in this period.
                </td>
              </tr>
            ) : null}
            <tr className="font-medium">
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right">{num(ret.totalBase)}</td>
              <td className="px-3 py-2 text-right">{num(ret.totalWht)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border bg-surface rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-lg font-semibold">{num(value)}</div>
    </div>
  );
}

export function TaxFilingReport({ data }: { data: TaxRegisters }) {
  const period = `${data.startDate}_${data.endDate}`;
  const { pp30 } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Tax filing · {data.startDate} – {data.endDate}
        </span>
        <Badge status={pp30.vatCredit > 0 ? "active" : "posted"}>
          {pp30.vatCredit > 0
            ? `VAT credit ${formatCurrency(pp30.vatCredit)}`
            : `VAT payable ${formatCurrency(pp30.netVatPayable)}`}
        </Badge>
      </div>

      <div
        className={`
          grid grid-cols-2 gap-3
          md:grid-cols-4
        `}
      >
        <Kpi label="Output VAT (sales)" value={pp30.outputVat} />
        <Kpi label="Input VAT (purchases)" value={pp30.inputVat} />
        <Kpi label="Net VAT payable" value={pp30.netVatPayable} />
        <Kpi
          label="WHT withheld (PND.3 + PND.53)"
          value={data.wht.pnd3.totalWht + data.wht.pnd53.totalWht}
        />
      </div>

      <VatRegisterCard
        title="Output VAT register (ภาษีขาย)"
        register={data.output}
        partyLabel="Customer"
        filenameStem="output-vat"
        period={period}
      />
      <VatRegisterCard
        title="Input VAT register (ภาษีซื้อ)"
        register={data.input}
        partyLabel="Supplier"
        filenameStem="input-vat"
        period={period}
      />

      <div className="border-border bg-surface rounded-lg border p-3">
        <div className="mb-2 text-sm font-medium">PP.30 summary (ภ.พ.30)</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <span className="text-muted-foreground">Standard-rated sales</span>
          <span className="text-right">{num(pp30.standardRatedSales)}</span>
          <span className="text-muted-foreground">
            Zero-rated / exempt sales
          </span>
          <span className="text-right">{num(pp30.zeroRatedOrExemptSales)}</span>
          <span className="text-muted-foreground">Output VAT</span>
          <span className="text-right">{num(pp30.outputVat)}</span>
          <span className="text-muted-foreground">Total purchases</span>
          <span className="text-right">{num(pp30.totalPurchases)}</span>
          <span className="text-muted-foreground">Input VAT</span>
          <span className="text-right">{num(pp30.inputVat)}</span>
          <span className="font-medium">Net VAT payable</span>
          <span className="text-right font-medium">
            {num(pp30.netVatPayable)}
          </span>
        </div>
      </div>

      <div
        className={`
          grid grid-cols-1 gap-4
          lg:grid-cols-2
        `}
      >
        <WhtReturnCard
          ret={data.wht.pnd3}
          subtitle="individuals"
          period={period}
        />
        <WhtReturnCard
          ret={data.wht.pnd53}
          subtitle="juristic persons"
          period={period}
        />
      </div>

      <p className="text-muted-foreground text-xs">{data.note}</p>
    </div>
  );
}
