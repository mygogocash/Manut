"use client";

import { Edit2, FileUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { ALL_FILTER, ESOP_STATUSES } from "@/components/hrms/hrms-constants";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ESOP_GRANT_TYPE_LABELS,
  type EsopGrant,
} from "@/services/hrms.service";

// Decimal columns from Prisma can come back as strings over JSON.
// Normalise once, then format.
function asNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Pick the right amount for the USD column. Returns null when this grant
 * has no USD-denominated value (e.g. percent-of-base grants or grants
 * priced in THB). Currency grants in other foreign currencies are folded
 * into the USD column with the ISO prefix so HR can still see the source
 * number.
 */
function usdValueText(g: EsopGrant): string {
  if (g.valueType !== "currency") return "—";
  const amount = asNum(g.currencyAmount);
  if (amount == null) return "—";
  if (g.currencyCode === "USD") {
    const suffix = g.allocationMode === "monthly_recurring" ? "/mo" : "";
    return `$${formatMoney(amount)}${suffix}`;
  }
  // Foreign currencies that aren't THB live here so they don't disappear.
  if (g.currencyCode && g.currencyCode !== "THB") {
    const suffix = g.allocationMode === "monthly_recurring" ? "/mo" : "";
    return `${g.currencyCode} ${formatMoney(amount)}${suffix}`;
  }
  return "—";
}

function thbValueText(g: EsopGrant): string {
  if (g.valueType !== "currency") return "—";
  const amount = asNum(g.currencyAmount);
  if (amount == null || g.currencyCode !== "THB") return "—";
  const suffix = g.allocationMode === "monthly_recurring" ? "/mo" : "";
  return `THB ${formatMoney(amount)}${suffix}`;
}

function sharesText(g: EsopGrant): string {
  if (g.valueType === "shares" && g.shares > 0) {
    return g.shares.toLocaleString();
  }
  if (g.valueType === "percent") {
    const pct = asNum(g.percentOfBase);
    return pct != null ? `${pct}% of base` : "—";
  }
  return "—";
}

function sourceNotesText(g: EsopGrant): string {
  // Display only the operator-entered Notes value. The internal `source`
  // field carries an importer-synthesized label that is operational noise;
  // the column should mirror the
  // Source / Notes cell from the xlsx exactly.
  return g.notes ?? "";
}

// Render a stored ISO date as "MMM YYYY" to mirror the Equity Summary
// Report's Start / End cells (e.g. "Jan 2025"); blank → null (em dash).
function monthLabel(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function EsopTab({
  grants,
  loading,
  statusFilter,
  onStatusFilterChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  canManage,
  onCreateGrant,
  onImportGrants,
  onEditGrant,
  onDeleteGrant,
  selectedIds,
  onSelectedIdsChange,
  onBulkDeleteSelected,
  onDeleteAll,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  grants: EsopGrant[];
  loading: boolean;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  canManage: boolean;
  onCreateGrant: () => void;
  onImportGrants: () => void;
  onEditGrant: (g: EsopGrant) => void;
  onDeleteGrant: (g: EsopGrant) => void;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  onBulkDeleteSelected: () => void;
  onDeleteAll: () => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: string) => void;
}) {
  // Default (sortBy unset): sort by employee name asc + grantDate desc
  // so each person's grants sit together, mirroring HR's Equity Summary
  // spreadsheet. When a column sort is active, leave server order alone
  // and drop the visual grouping so the table reads like a flat list.
  const isGrouped = !sortBy;
  const sortedGrants = useMemo(() => {
    if (!isGrouped) return grants;
    return [...grants].sort((a, b) => {
      const byName = a.employee.name.localeCompare(b.employee.name);
      if (byName !== 0) return byName;
      return new Date(b.grantDate).getTime() - new Date(a.grantDate).getTime();
    });
  }, [grants, isGrouped]);

  const columns = useMemo(
    () => [
      {
        key: "employee",
        header: "Name of Staff",
        sortable: true,
        render: (g: EsopGrant, index: number) => {
          // Suppress the name on subsequent rows of the same person so
          // the table reads as one group per employee (visual rowspan).
          // Grouping is only active in the default sort — when a column
          // sort is on, every row shows its full name + department.
          const prev = sortedGrants[index - 1];
          if (isGrouped && prev && prev.employee.id === g.employee.id) {
            return <span className="text-muted-foreground/30 text-xs">↳</span>;
          }
          return (
            <div className="flex flex-col">
              <Link
                href={`/hrms/esop/${g.employee.id}`}
                className={`
                  text-foreground text-xs font-semibold
                  hover:text-primary hover:underline
                `}
              >
                {g.employee.name}
              </Link>
              {g.employee.department && (
                <span
                  className={`
                    text-muted-foreground text-[10px] tracking-wide uppercase
                  `}
                >
                  {g.employee.department}
                </span>
              )}
            </div>
          );
        },
        className: "min-w-[180px] align-top",
      },
      {
        key: "grantType",
        header: "Equity Type",
        sortable: true,
        render: (g: EsopGrant) => (
          <span className="text-xs">
            {ESOP_GRANT_TYPE_LABELS[g.grantType] ?? g.grantType}
          </span>
        ),
      },
      {
        key: "usd",
        header: "Equity in USD",
        sortable: true,
        render: (g: EsopGrant) => (
          <span className="tabular-nums">{usdValueText(g)}</span>
        ),
        className: "text-right",
      },
      {
        key: "thb",
        header: "Equity in THB",
        sortable: true,
        render: (g: EsopGrant) => (
          <span className="tabular-nums">{thbValueText(g)}</span>
        ),
        className: "text-right",
      },
      {
        key: "shares",
        header: "No. of Shares",
        sortable: true,
        render: (g: EsopGrant) => (
          <span className="tabular-nums">{sharesText(g)}</span>
        ),
        className: "text-right",
      },
      {
        key: "vestStart",
        header: "Start",
        render: (g: EsopGrant) => {
          const label = monthLabel(g.allocationStartMonth);
          return label ? (
            <span className="tabular-nums">{label}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        key: "vestEnd",
        header: "End",
        render: (g: EsopGrant) => {
          const label = monthLabel(g.allocationEndMonth);
          return label ? (
            <span className="tabular-nums">{label}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        key: "vestedToDate",
        // Auto-computed (linear by elapsed months) unless an admin pinned a
        // manual figure — a trailing "*" marks the override. Only meaningful
        // for scheduled grants; outright grants show "—" (they're fully
        // vested, so a "to date" figure would just restate No. of Shares).
        header: "Total Vesting to date",
        render: (g: EsopGrant) =>
          g.scheduled ? (
            <span
              className="tabular-nums"
              title={
                g.vestedToDateOverride != null
                  ? "Manual override"
                  : "Auto-calculated"
              }
            >
              {g.vestedToDate.toLocaleString()}
              {g.vestedToDateOverride != null ? " *" : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        className: "text-right",
      },
      {
        key: "lockMonths",
        header: "Lock Period",
        sortable: true,
        render: (g: EsopGrant) =>
          g.lockMonths == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">{`${g.lockMonths}mo`}</span>
          ),
      },
      {
        key: "vestingMonths",
        header: "Vesting Period",
        sortable: true,
        render: (g: EsopGrant) =>
          g.vestingMonths == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">{`${g.vestingMonths}mo`}</span>
          ),
      },
      {
        key: "sourceNotes",
        header: "Source / Notes",
        render: (g: EsopGrant) => {
          const text = sourceNotesText(g);
          if (!text) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className={`
                text-muted-foreground line-clamp-2 max-w-[260px] text-[11px]
              `}
              title={text}
            >
              {text}
            </span>
          );
        },
        className: "min-w-[200px] align-top",
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (g: EsopGrant) => <Badge status={g.status}>{g.status}</Badge>,
      },
      ...(canManage
        ? [
            {
              key: "actions",
              header: "",
              className: "w-[80px]",
              render: (g: EsopGrant) => (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditGrant(g);
                    }}
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGrant(g);
                    }}
                  >
                    <Trash2 className="text-destructive size-3.5" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canManage, onEditGrant, onDeleteGrant, sortedGrants, isGrouped],
  );

  // Thicker top border on the first row of each employee group makes the
  // grouping obvious without needing real rowspan (which would fight
  // both pagination and the shared DataTable layout). Disabled when a
  // column sort is active — the table is flat in that mode.
  const getRowClassName = useMemo(
    () => (item: EsopGrant, index: number) => {
      if (!isGrouped) return undefined;
      const prev = sortedGrants[index - 1];
      const isGroupStart = !prev || prev.employee.id !== item.employee.id;
      return isGroupStart && index !== 0
        ? "border-t-border/80! border-t-2!"
        : undefined;
    },
    [sortedGrants, isGrouped],
  );

  return (
    <>
      <div
        className={`
          border-border bg-surface flex items-center gap-2 rounded-lg border p-3
          shadow-sm
        `}
      >
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-10 w-[160px] text-xs">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {ESOP_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {canManage && (
          <>
            <Button
              variant="outline"
              onClick={onDeleteAll}
              className={cn(`
                text-destructive
                hover:bg-destructive/10 hover:text-destructive
              `)}
              disabled={totalCount === 0 && grants.length === 0}
            >
              <Trash2 className="size-3.5" />
              Delete all
            </Button>
            <Button variant="outline" onClick={onImportGrants}>
              <FileUp className="size-3.5" />
              Import from xlsx
            </Button>
            <Button onClick={onCreateGrant}>
              <Plus className="size-3.5" />
              New grant
            </Button>
          </>
        )}
      </div>

      <DataTable
        columns={columns}
        data={sortedGrants}
        loading={loading}
        emptyMessage="No ESOP grants found"
        onRowClick={canManage ? onEditGrant : undefined}
        enableRowSelection={canManage}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={onSelectedIdsChange}
        getRowClassName={getRowClassName}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
        selectionActions={
          canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`
                text-destructive h-7 px-2 text-xs
                hover:bg-destructive/10 hover:text-destructive
              `}
              onClick={onBulkDeleteSelected}
            >
              <Trash2 className="mr-1 size-3.5" />
              Delete selected
            </Button>
          ) : undefined
        }
        pagination={
          <DataPagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        }
      />
    </>
  );
}
