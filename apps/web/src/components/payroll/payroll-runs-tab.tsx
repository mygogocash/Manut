import { CheckCircle, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  ALL_FILTER,
  formatCurrency,
  RUN_STATUSES,
} from "@/components/payroll/payroll-utils";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Entity } from "@/services/entity.service";
import type { PayrollRun } from "@/services/payroll.service";

interface PayrollRunsTabProps {
  runs: PayrollRun[];
  loading: boolean;
  entities: Entity[];
  canApprove: boolean;
  entityFilter: string;
  statusFilter: string;
  periodFilter: string;
  filtersDirty: boolean;
  onEntityFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onPeriodFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onApproveRun: (run: PayrollRun) => void;
  /** When provided, a Delete button renders next to each row's actions. */
  onDeleteRun?: (run: PayrollRun) => void | Promise<void>;
  onRowClick: (run: PayrollRun) => void;
  pagination: ReactNode;
}

export function PayrollRunsTab({
  runs,
  loading,
  entities,
  canApprove,
  entityFilter,
  statusFilter,
  periodFilter,
  filtersDirty,
  onEntityFilterChange,
  onStatusFilterChange,
  onPeriodFilterChange,
  onClearFilters,
  onApproveRun,
  onDeleteRun,
  onRowClick,
  pagination,
}: PayrollRunsTabProps) {
  const [pendingDelete, setPendingDelete] = useState<PayrollRun | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns = [
    {
      key: "period",
      header: "Period",
      render: (r: PayrollRun) => (
        <span className="font-medium tabular-nums">{r.period}</span>
      ),
    },
    {
      key: "entity",
      mobileRole: "subtitle" as const,
      header: "Entity",
      render: (r: PayrollRun) => r.entity.name,
    },
    {
      key: "status",
      mobileRole: "badge" as const,
      header: "Status",
      render: (r: PayrollRun) => <Badge status={r.status}>{r.status}</Badge>,
    },
    {
      key: "totalNet",
      mobileRole: "field" as const,
      header: "Total Net",
      render: (r: PayrollRun) => (
        <span className="tabular-nums">{formatCurrency(r.totalNet)}</span>
      ),
      className: "text-right",
    },
    {
      key: "runner",
      header: "Run By",
      render: (r: PayrollRun) => r.runner.name,
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      render: (r: PayrollRun) => {
        const showApprove = canApprove && r.status === "draft";
        const showDelete = !!onDeleteRun;
        if (!showApprove && !showDelete) return null;
        return (
          <div className="flex items-center justify-end gap-2">
            {showApprove && (
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  void onApproveRun(r);
                }}
              >
                <CheckCircle className="mr-1 size-3" />
                Approve
              </Button>
            )}
            {showDelete && (
              <Button
                size="xs"
                variant="outline"
                className={`
                  text-destructive
                  hover:text-destructive
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(r);
                }}
              >
                <Trash2 className="mr-1 size-3" />
                Delete
              </Button>
            )}
          </div>
        );
      },
      className: "text-right",
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
            {RUN_STATUSES.map((s) => (
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
        data={runs}
        loading={loading}
        emptyMessage="No payroll runs found"
        onRowClick={onRowClick}
        pagination={pagination}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(next) => {
          if (!deleting && !next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payroll run?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This will permanently delete the ${pendingDelete.period} run for ${pendingDelete.entity.name} along with every imported payslip. The action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingDelete || !onDeleteRun) return;
                try {
                  setDeleting(true);
                  await onDeleteRun(pendingDelete);
                  setPendingDelete(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
