"use client";

import { format } from "date-fns";
import { FileUp, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type EquityMonthlySalary,
  MONTH_NAMES,
  type MonthName,
} from "@/services/equity-salary.service";

interface EquityMonthlySalaryTabProps {
  rows: EquityMonthlySalary[];
  loading: boolean;
  canManage: boolean;
  onImport: () => void;
  onDeleteAll: () => void;
}

function formatShares(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function EquityMonthlySalaryTab({
  rows,
  loading,
  canManage,
  onImport,
  onDeleteAll,
}: EquityMonthlySalaryTabProps) {
  // Sort: year DESC, then employeeName ASC. Server already returns in
  // this order; the local sort makes it deterministic for tests and
  // future callers that pre-shuffle the list.
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return a.employeeName.localeCompare(b.employeeName);
    });
  }, [rows]);

  const columns = useMemo(() => {
    const monthCols = MONTH_NAMES.map((m) => ({
      key: `month_${m}`,
      header: m,
      className: "text-right",
      render: (row: EquityMonthlySalary) => (
        <span className="text-xs tabular-nums">
          {formatShares(row.monthlyShares[m as MonthName])}
        </span>
      ),
    }));

    return [
      {
        key: "employeeName",
        header: "Employee",
        render: (row: EquityMonthlySalary) => (
          <span className="text-foreground text-xs font-semibold">
            {row.employeeName}
          </span>
        ),
        className: "min-w-[180px]",
      },
      {
        key: "position",
        header: "Position",
        render: (row: EquityMonthlySalary) => (
          <span className="text-muted-foreground text-xs">
            {row.position ?? "—"}
          </span>
        ),
      },
      {
        key: "currency",
        header: "Currency",
        render: (row: EquityMonthlySalary) => (
          <span
            className={`
              text-muted-foreground text-[10px] tracking-wide uppercase
            `}
          >
            {row.currency ?? "—"}
          </span>
        ),
      },
      {
        key: "year",
        header: "Year",
        render: (row: EquityMonthlySalary) => (
          <span className="text-xs tabular-nums">{row.year}</span>
        ),
      },
      {
        key: "startDate",
        header: "Start date",
        render: (row: EquityMonthlySalary) => (
          <span className="text-muted-foreground text-xs">
            {row.startDate
              ? format(new Date(row.startDate), "MMM d, yyyy")
              : "—"}
          </span>
        ),
      },
      ...monthCols,
    ];
  }, []);

  return (
    <>
      <div
        className={`
          border-border bg-surface flex flex-wrap items-center gap-2 rounded-lg
          border p-3 shadow-sm
        `}
      >
        <p className="text-muted-foreground flex-1 text-xs">
          Per-employee monthly equity allocations imported from HR&rsquo;s
          &ldquo;Equity Monthly Salary&rdquo; spreadsheet. Re-importing the file
          replaces every row for the same year.
        </p>

        {canManage && (
          <>
            <Button
              variant="outline"
              onClick={onDeleteAll}
              className={cn(`
                text-destructive
                hover:bg-destructive/10 hover:text-destructive
              `)}
              disabled={rows.length === 0}
            >
              <Trash2 className="size-3.5" />
              Delete all
            </Button>
            <Button variant="outline" onClick={onImport}>
              <FileUp className="size-3.5" />
              Import from xlsx
            </Button>
          </>
        )}
      </div>

      <DataTable
        columns={columns}
        data={sortedRows}
        loading={loading}
        emptyMessage="No equity monthly salary records yet"
      />
    </>
  );
}
