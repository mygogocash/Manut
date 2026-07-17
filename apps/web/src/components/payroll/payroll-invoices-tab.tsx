import type { ReactNode } from "react";

import {
  ALL_FILTER,
  formatCurrency,
  INVOICE_STATUSES,
} from "@/components/payroll/payroll-utils";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Entity } from "@/services/entity.service";
import type { ConsultantInvoice } from "@/services/payroll.service";

interface PayrollInvoicesTabProps {
  invoices: ConsultantInvoice[];
  loading: boolean;
  entities: Entity[];
  entityFilter: string;
  statusFilter: string;
  periodFilter: string;
  filtersDirty: boolean;
  onEntityFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onPeriodFilterChange: (value: string) => void;
  onClearFilters: () => void;
  pagination: ReactNode;
}

export function PayrollInvoicesTab({
  invoices,
  loading,
  entities,
  entityFilter,
  statusFilter,
  periodFilter,
  filtersDirty,
  onEntityFilterChange,
  onStatusFilterChange,
  onPeriodFilterChange,
  onClearFilters,
  pagination,
}: PayrollInvoicesTabProps) {
  const columns = [
    {
      key: "invoiceNo",
      header: "Invoice No",
      render: (i: ConsultantInvoice) => (
        <span className="font-medium">{i.invoiceNo}</span>
      ),
    },
    {
      key: "consultant",
      header: "Consultant",
      render: (i: ConsultantInvoice) => i.consultant.name,
    },
    {
      key: "entity",
      header: "Entity",
      render: (i: ConsultantInvoice) => i.entity.name,
    },
    {
      key: "amount",
      header: "Amount",
      render: (i: ConsultantInvoice) => (
        <span className="tabular-nums">{formatCurrency(i.amount)}</span>
      ),
      className: "text-right",
    },
    {
      key: "whtAmount",
      header: "WHT",
      render: (i: ConsultantInvoice) => (
        <span className="tabular-nums">{formatCurrency(i.whtAmount)}</span>
      ),
      className: "text-right",
    },
    {
      key: "netAmount",
      header: "Net",
      render: (i: ConsultantInvoice) => (
        <span className="tabular-nums">{formatCurrency(i.netAmount)}</span>
      ),
      className: "text-right",
    },
    {
      key: "period",
      header: "Period",
      render: (i: ConsultantInvoice) => (
        <span className="tabular-nums">{i.period}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (i: ConsultantInvoice) => (
        <Badge status={i.status}>{i.status}</Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
          shadow-sm
          md:flex-row md:items-center
        `}
      >
        <Select value={entityFilter} onValueChange={onEntityFilterChange}>
          <SelectTrigger className="h-10 min-w-[140px] text-xs">
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

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-10 min-w-[120px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <MonthYearPicker
          value={periodFilter}
          onChange={onPeriodFilterChange}
          className="h-8 w-auto text-xs"
          placeholder="Filter by period"
        />

        {filtersDirty && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClearFilters}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        loading={loading}
        emptyMessage="No consultant invoices found"
        pagination={pagination}
      />
    </div>
  );
}
