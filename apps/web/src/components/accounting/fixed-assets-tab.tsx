"use client";

import {
  ArrowLeftRight,
  Download,
  History,
  MoreHorizontal,
  PackageMinus,
  Pencil,
  Plus,
  Scale,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ALL_FILTER,
  FIXED_ASSET_STATUSES,
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { FixedAssetCountPanel } from "@/components/accounting/fixed-asset-count-panel";
import { FixedAssetDeferredTaxPanel } from "@/components/accounting/fixed-asset-deferred-tax-panel";
import { FixedAssetDepreciationRunPanel } from "@/components/accounting/fixed-asset-depreciation-run-panel";
import { FixedAssetDialog } from "@/components/accounting/fixed-asset-dialog";
import { FixedAssetDisposalQueue } from "@/components/accounting/fixed-asset-disposal-queue";
import { FixedAssetDisposeDialog } from "@/components/accounting/fixed-asset-dispose-dialog";
import { FixedAssetImportDialog } from "@/components/accounting/fixed-asset-import-dialog";
import {
  FixedAssetRemeasurementDialog,
  FixedAssetRemeasurementQueue,
} from "@/components/accounting/fixed-asset-remeasurement-dialog";
import { FixedAssetReportsPanel } from "@/components/accounting/fixed-asset-reports-panel";
import {
  FixedAssetMovementHistory,
  FixedAssetTransferDialog,
  FixedAssetTransferQueue,
} from "@/components/accounting/fixed-asset-transfer-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteFixedAsset,
  downloadFixedAssetExport,
  type FixedAsset,
  type FixedAssetCategory,
  listFixedAssetCategories,
  listFixedAssets,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  idle: "Idle",
  pending_disposal: "Pending disposal",
  disposed: "Disposed",
  written_off: "Written off",
  transferred: "Transferred",
};

/** Statuses that still allow a per-asset action (dispose / transfer / remeasure). */
const ACTIONABLE_STATUSES = ["active", "idle"];

/**
 * Secondary nav inside the Fixed Asset tab. The register stays the default
 * view; every other section is one of the Phase-2 workflows. Ids are stable so
 * they can carry a deep link later without renaming.
 */
type FixedAssetSection =
  | "register"
  | "depreciation"
  | "remeasurements"
  | "transfers"
  | "count"
  | "deferred-tax"
  | "reports";

const SECTIONS: { id: FixedAssetSection; label: string }[] = [
  { id: "register", label: "Register" },
  { id: "depreciation", label: "Depreciation run" },
  { id: "remeasurements", label: "Remeasurements" },
  { id: "transfers", label: "Transfers" },
  { id: "count", label: "Physical count" },
  { id: "deferred-tax", label: "Deferred tax" },
  { id: "reports", label: "Reports" },
];

/**
 * One line of context per section. The approval queues hide themselves when
 * they have no rows, so without this a freshly-opened section would render as
 * a blank page rather than an empty one.
 */
const SECTION_HINTS: Record<FixedAssetSection, string> = {
  register: "",
  depreciation:
    "Preview the monthly charge per category, then post it to the general ledger. The run is idempotent on the period.",
  remeasurements:
    "Revaluations, impairments and impairment reversals. Raise one from an asset's row menu; the profit-or-loss / OCI split is computed server-side.",
  transfers:
    "Location, custodian and cross-entity moves. Raise one from an asset's row menu; the asset only moves once the transfer is approved.",
  count:
    "Open a count session, scan tags against the register, then review the variance before closing the session.",
  "deferred-tax":
    "Deferred tax on the book-vs-tax life difference. Rates are maintained on the Setup tab.",
  reports:
    "Register, depreciation schedule, disposal and movement reports for the selected entity.",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FixedAssetsTabProps {
  entities: Entity[];
}

export function FixedAssetsTab({ entities }: FixedAssetsTabProps) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("accounting:create");
  const canApprove = hasPermission("accounting:approve");
  const canPost = hasPermission("accounting:post");
  const canAdmin = hasPermission("accounting:admin");

  const [section, setSection] = useState<FixedAssetSection>("register");
  const [entityId, setEntityId] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_FILTER);
  const [search, setSearch] = useState("");
  const [asOf, setAsOf] = useState<string>(todayIso());

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedAsset | null>(null);
  const [disposing, setDisposing] = useState<FixedAsset | null>(null);
  const [transferring, setTransferring] = useState<FixedAsset | null>(null);
  const [remeasuring, setRemeasuring] = useState<FixedAsset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<FixedAsset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // One counter drives every approval queue + workflow panel: a submit or an
  // approval anywhere in the tab can change what the others show.
  const [queueKey, setQueueKey] = useState(0);
  // Monotonic request id: a filter change fires a fetch for the old page before
  // the page resets, so responses can land out of order and paint stale rows.
  const loadSeq = useRef(0);
  const pagination = usePagination();

  useEffect(() => {
    if (!entityId && entities[0]) setEntityId(entities[0].id);
  }, [entityId, entities]);

  useEffect(() => {
    // Category codes are per-entity, so a stale selection silently empties the
    // register after an entity switch.
    setCategoryFilter(ALL_FILTER);
    if (!entityId) {
      setCategories([]);
      return;
    }
    listFixedAssetCategories({ entityId })
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }, [entityId]);

  const load = useCallback(async () => {
    if (!entityId) return;
    const seq = ++loadSeq.current;
    try {
      setLoading(true);
      const res = await listFixedAssets({
        page: pagination.page,
        limit: pagination.pageSize,
        entityId,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        categoryCode:
          categoryFilter === ALL_FILTER ? undefined : categoryFilter,
        search: search.trim() || undefined,
        asOf,
        sortBy: "assetNo",
        sortOrder: "asc",
      });
      if (seq !== loadSeq.current) return; // superseded by a newer request
      setAssets(res.data);
      pagination.setTotalCount(res.meta.total);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load fixed assets",
      );
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entityId,
    statusFilter,
    categoryFilter,
    search,
    asOf,
    pagination.page,
    pagination.pageSize,
    pagination.setTotalCount,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, statusFilter, categoryFilter, search, pagination.setPage]);

  // A workflow write (disposal, transfer, remeasurement, count close, posting)
  // can change both the register and every queue, so refresh all of them.
  const refreshAll = useCallback(() => {
    setQueueKey((k) => k + 1);
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (asset: FixedAsset) => {
      if (
        !window.confirm(
          `Remove asset "${asset.assetNo}"? It is soft-deleted and can be restored.`,
        )
      ) {
        return;
      }
      try {
        await deleteFixedAsset(asset.id);
        toast.success(`Asset "${asset.assetNo}" removed`);
        void load();
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to remove asset",
        );
      }
    },
    [load],
  );

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      await downloadFixedAssetExport(entityId, asOf);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to export the register",
      );
    } finally {
      setExporting(false);
    }
  }, [entityId, asOf]);

  const columns = useMemo(
    () => [
      {
        key: "assetNo",
        mobileRole: "title" as const,
        header: "Code",
        render: (a: FixedAsset) => (
          <span className="font-medium">{a.assetNo}</span>
        ),
      },
      {
        key: "name",
        mobileRole: "subtitle" as const,
        header: "Asset",
        render: (a: FixedAsset) => (
          <div>
            <div>{a.name}</div>
            {a.nameTh ? (
              <div className="text-muted-foreground text-xs">{a.nameTh}</div>
            ) : null}
          </div>
        ),
      },
      {
        key: "categoryCode",
        mobileRole: "field" as const,
        header: "Category",
        render: (a: FixedAsset) => (
          <span className="text-muted-foreground text-xs">
            {a.categoryCode}
          </span>
        ),
      },
      {
        key: "quantity",
        mobileRole: "detail" as const,
        header: "Qty",
        className: "text-right",
        render: (a: FixedAsset) => (
          <span className="tabular-nums">{a.quantity}</span>
        ),
      },
      {
        key: "purchasePrice",
        mobileRole: "detail" as const,
        header: "Cost",
        className: "text-right",
        render: (a: FixedAsset) => (
          <span className="tabular-nums">
            {formatCurrency(a.purchasePrice)}
          </span>
        ),
      },
      {
        key: "netBookValue",
        mobileRole: "field" as const,
        header: "Net book value",
        className: "text-right",
        render: (a: FixedAsset) => (
          <span className="tabular-nums">{formatCurrency(a.netBookValue)}</span>
        ),
      },
      {
        key: "purchaseDate",
        mobileRole: "detail" as const,
        header: "Purchased",
        render: (a: FixedAsset) => (
          <span className="tabular-nums">{formatDate(a.purchaseDate)}</span>
        ),
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (a: FixedAsset) => (
          <Badge status={a.status}>{STATUS_LABELS[a.status] ?? a.status}</Badge>
        ),
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "w-12 text-right",
        render: (a: FixedAsset) => {
          if (!canCreate) return null;
          const actionable = ACTIONABLE_STATUSES.includes(a.status);
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(a);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="mr-2 size-3.5" />
                    Edit
                  </DropdownMenuItem>
                  {actionable && (
                    <DropdownMenuItem onClick={() => setTransferring(a)}>
                      <ArrowLeftRight className="mr-2 size-3.5" />
                      Transfer
                    </DropdownMenuItem>
                  )}
                  {actionable && (
                    <DropdownMenuItem onClick={() => setRemeasuring(a)}>
                      <Scale className="mr-2 size-3.5" />
                      Remeasure
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setHistoryAsset(a)}>
                    <History className="mr-2 size-3.5" />
                    Movement history
                  </DropdownMenuItem>
                  {actionable && (
                    <DropdownMenuItem onClick={() => setDisposing(a)}>
                      <PackageMinus className="mr-2 size-3.5" />
                      Dispose / write off
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => void handleDelete(a)}
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canCreate, handleDelete],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
          shadow-sm
          md:flex-row md:items-center
        `}
      >
        <Select value={entityId} onValueChange={setEntityId}>
          <SelectTrigger className="h-10 min-w-[150px] text-xs">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <nav
          aria-label="Fixed asset sections"
          className={`
            flex flex-wrap items-center gap-1
            md:ml-auto
          `}
        >
          {SECTIONS.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={section === s.id ? "secondary" : "ghost"}
              aria-current={section === s.id ? "page" : undefined}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </nav>
      </div>

      {section === "register" ? (
        <>
          <div
            className={`
              border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
              shadow-sm
              md:flex-row md:flex-wrap md:items-center
            `}
          >
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 min-w-[130px] text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 min-w-[130px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                {FIXED_ASSET_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code / name / serial"
              className={`
                h-10 min-w-[180px] text-xs
                md:flex-1
              `}
            />

            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground whitespace-nowrap">
                As at
              </span>
              <Input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value || todayIso())}
                className="h-10 text-xs"
              />
            </label>

            <div
              className={`
                flex shrink-0 items-center gap-2
                md:ml-auto
              `}
            >
              <Button
                variant="outline"
                onClick={() => void handleExport()}
                disabled={!entityId || exporting}
              >
                <Download className="size-3.5" />
                Export
              </Button>
              {canCreate && (
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                  disabled={!entityId}
                >
                  <Upload className="size-3.5" />
                  Import
                </Button>
              )}
              {canCreate && (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                  disabled={!entityId}
                >
                  <Plus className="size-3.5" />
                  Add asset
                </Button>
              )}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={assets}
            loading={loading}
            emptyMessage="No fixed assets yet"
            onRowClick={(a: FixedAsset) => {
              setEditing(a);
              setDialogOpen(true);
            }}
            pagination={
              <DataPagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalCount={pagination.totalCount}
                totalPages={pagination.totalPages}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            }
          />

          {canApprove ? (
            <FixedAssetDisposalQueue
              entityId={entityId}
              canApprove={canApprove}
              refreshKey={queueKey}
              onActioned={() => void load()}
            />
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground px-1 text-xs">
          {SECTION_HINTS[section]}
        </p>
      )}

      {!entityId && section !== "register" ? (
        <p className="text-muted-foreground p-3 text-sm">
          Select an entity to use this section.
        </p>
      ) : null}

      {entityId && section === "depreciation" ? (
        <FixedAssetDepreciationRunPanel
          key={`fa-dep-${entityId}`}
          entityId={entityId}
          canPost={canPost}
          refreshKey={queueKey}
          onActioned={refreshAll}
        />
      ) : null}

      {entityId && section === "remeasurements" ? (
        <FixedAssetRemeasurementQueue
          key={`fa-remeas-${entityId}`}
          entityId={entityId}
          canApprove={canApprove}
          refreshKey={queueKey}
          onActioned={() => void load()}
        />
      ) : null}

      {entityId && section === "transfers" ? (
        <FixedAssetTransferQueue
          key={`fa-transfer-${entityId}`}
          entityId={entityId}
          canApprove={canApprove}
          refreshKey={queueKey}
          onActioned={() => void load()}
          entities={entities}
        />
      ) : null}

      {entityId && section === "count" ? (
        <FixedAssetCountPanel
          key={`fa-count-${entityId}`}
          entityId={entityId}
          canCreate={canCreate}
          canApprove={canApprove}
          refreshKey={queueKey}
          onActioned={() => void load()}
        />
      ) : null}

      {entityId && section === "deferred-tax" ? (
        <FixedAssetDeferredTaxPanel
          key={`fa-dtax-${entityId}`}
          entityId={entityId}
          canAdmin={canAdmin}
          refreshKey={queueKey}
          // The rate manager lives on the Setup tab next to the asset
          // categories, so it is not embedded a second time here.
          embedRateManager={false}
          onActioned={refreshAll}
        />
      ) : null}

      {entityId && section === "reports" ? (
        <FixedAssetReportsPanel
          key={`fa-reports-${entityId}`}
          entityId={entityId}
        />
      ) : null}

      <FixedAssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        asset={editing}
        entities={entities}
        defaultEntityId={entityId}
        onSaved={() => {
          setDialogOpen(false);
          setEditing(null);
          void load();
        }}
      />

      <FixedAssetImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityId={entityId}
        onImported={() => void load()}
      />

      <FixedAssetDisposeDialog
        open={Boolean(disposing)}
        onOpenChange={(o) => !o && setDisposing(null)}
        asset={disposing}
        onSaved={() => {
          setDisposing(null);
          refreshAll();
        }}
      />

      <FixedAssetTransferDialog
        open={Boolean(transferring)}
        onOpenChange={(o) => !o && setTransferring(null)}
        asset={transferring}
        entities={entities}
        onSaved={refreshAll}
      />

      <FixedAssetRemeasurementDialog
        open={Boolean(remeasuring)}
        onOpenChange={(o) => !o && setRemeasuring(null)}
        asset={remeasuring}
        onSaved={() => {
          setRemeasuring(null);
          refreshAll();
        }}
      />

      <Dialog
        open={Boolean(historyAsset)}
        onOpenChange={(o) => !o && setHistoryAsset(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Movement history</DialogTitle>
            <DialogDescription>
              {historyAsset
                ? `${historyAsset.assetNo} — ${historyAsset.name}. Every location, custodian and cross-entity transfer raised against this asset.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {historyAsset ? (
            <FixedAssetMovementHistory
              key={historyAsset.id}
              assetId={historyAsset.id}
              refreshKey={queueKey}
              entities={entities}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
