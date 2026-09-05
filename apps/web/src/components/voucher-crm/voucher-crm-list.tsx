"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  Download,
  Edit,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { SortableColumnHead } from "@/components/shared/sortable-column-head";
import { Tabs } from "@/components/shared/tabs";
import { useColumnWidths } from "@/components/shared/use-column-widths";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VoucherCrmFormDialog } from "@/components/voucher-crm/voucher-crm-form-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { type ExportFormat, exportRows } from "@/lib/crm-export";
import { useAuth } from "@/providers/auth-provider";
import {
  archiveVoucherEntry,
  type CreateVoucherEntryInput,
  deleteVoucherEntry,
  importVoucherEntries,
  listVoucherEntries,
  reorderVoucherEntries,
  unarchiveVoucherEntry,
  type VoucherEntry,
  type VoucherTotals,
} from "@/services/voucher-crm.service";

// Reorderable column registry (mirrors the IT CRM pattern). Drag
// handle (left) + kebab actions (right) are fixed; these middle
// columns rearrange via header drag, persisted per-browser.
const VOU_COL_STORAGE_KEY = "voucher-crm-col-order-v1";
type VouColKey =
  "rownum" | "partner" | "country" | "redeemed" | "issued" | "refund";
const VOU_COL_DEFAULT_ORDER: VouColKey[] = [
  "rownum",
  "partner",
  "country",
  "redeemed",
  "issued",
  "refund",
];
// Column widths now come from VOU_COL_DEFAULT_WIDTHS (drag-to-resize,
// table-fixed layout); headClassName carries only alignment.
const VOU_COL_META: Record<
  VouColKey,
  { label: string; headClassName?: string; numeric?: boolean }
> = {
  rownum: { label: "#" },
  partner: { label: "Partner" },
  country: { label: "Country" },
  redeemed: { label: "Redeemed", headClassName: "text-right", numeric: true },
  issued: { label: "Issued", headClassName: "text-right", numeric: true },
  refund: { label: "Refund", headClassName: "text-right", numeric: true },
};

const VOU_COL_WIDTH_STORAGE_KEY = "voucher-crm-col-width-v1";
const VOU_COL_DEFAULT_WIDTHS: Record<VouColKey, number> = {
  rownum: 48,
  partner: 220,
  country: 160,
  redeemed: 110,
  issued: 110,
  refund: 110,
};

export function VoucherCrmList() {
  const { hasAnyPermission } = useAuth();
  const canCreate = hasAnyPermission(
    "voucher-crm:create",
    "voucher-crm:manage",
  );
  const canManage = hasAnyPermission(
    "voucher-crm:update",
    "voucher-crm:manage",
  );
  const canDelete = hasAnyPermission(
    "voucher-crm:delete",
    "voucher-crm:manage",
  );

  const [entries, setEntries] = useState<VoucherEntry[]>([]);
  const [totals, setTotals] = useState<VoucherTotals>({
    redeemed: 0,
    issued: 0,
    refund: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  // Active | Archived view. Orthogonal to search — the Archived tab shows
  // archived rows regardless of the search term.
  const [archived, setArchived] = useState(false);

  const pagination = usePagination();
  const { page, pageSize, setPage, setPageSize, setTotalCount, totalPages } =
    pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VoucherEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Column order — hydrated from localStorage on mount (client-only).
  const [colOrder, setColOrder] = useState<VouColKey[]>(VOU_COL_DEFAULT_ORDER);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(VOU_COL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const filtered = parsed.filter((k): k is VouColKey =>
        VOU_COL_DEFAULT_ORDER.includes(k as VouColKey),
      );
      const missing = VOU_COL_DEFAULT_ORDER.filter(
        (k) => !filtered.includes(k),
      );
      setColOrder([...filtered, ...missing]);
    } catch {
      // ignore corrupt storage
    }
  }, []);
  const persistColOrder = useCallback((next: VouColKey[]) => {
    setColOrder(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(VOU_COL_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / disabled storage
      }
    }
  }, []);

  const { widths, setWidth } = useColumnWidths(
    VOU_COL_WIDTH_STORAGE_KEY,
    VOU_COL_DEFAULT_WIDTHS,
  );

  // Row drag-to-reorder is disabled while a search is active (a
  // partial view can't safely persist a global ordering).
  const reorderEnabled = useMemo(
    () => !debouncedSearch.trim() && !archived && !loading,
    [debouncedSearch, archived, loading],
  );
  const prePersistOrder = useRef<VoucherEntry[] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Column reorder (header drag) — keys are short strings, distinct
    // from the row UUIDs.
    if (VOU_COL_DEFAULT_ORDER.includes(active.id as VouColKey)) {
      const from = colOrder.indexOf(active.id as VouColKey);
      const to = colOrder.indexOf(over.id as VouColKey);
      if (from < 0 || to < 0) return;
      persistColOrder(arrayMove(colOrder, from, to));
      return;
    }

    const oldIndex = entries.findIndex((e) => e.id === active.id);
    const newIndex = entries.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    prePersistOrder.current = entries;
    const next = arrayMove(entries, oldIndex, newIndex);
    setEntries(next);
    try {
      await reorderVoucherEntries(next.map((e) => e.id));
    } catch (err) {
      if (prePersistOrder.current) setEntries(prePersistOrder.current);
      const msg =
        err instanceof ApiError ? err.message : "Failed to reorder rows";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listVoucherEntries({
        page,
        limit: pageSize,
        search: debouncedSearch.trim() || undefined,
        archived: archived || undefined,
      });
      setEntries(res.data);
      setTotals(res.totals);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load voucher rows";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, archived, setTotalCount]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const handleCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((e: VoucherEntry) => {
    setEditing(e);
    setFormOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // Export every matching row (not just the current page) so the file
  // mirrors the full filtered dataset.
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(true);
      try {
        const res = await listVoucherEntries({
          page: 1,
          limit: 1000,
          search: debouncedSearch.trim() || undefined,
          archived: archived || undefined,
        });
        if (res.data.length === 0) {
          toast.error("Nothing to export");
          return;
        }
        exportRows(
          "voucher-crm",
          [
            { header: "Partner", value: (r: VoucherEntry) => r.partner },
            { header: "Country", value: (r: VoucherEntry) => r.country ?? "" },
            { header: "Redeemed", value: (r: VoucherEntry) => r.redeemed },
            { header: "Issued", value: (r: VoucherEntry) => r.issued },
            { header: "Refund", value: (r: VoucherEntry) => r.refund },
          ],
          res.data,
          format,
        );
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Failed to export";
        toast.error(msg);
      } finally {
        setExporting(false);
      }
    },
    [debouncedSearch, archived],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVoucherEntry(deleteTarget.id);
      toast.success("Voucher row deleted");
      setDeleteTarget(null);
      void fetchEntries();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete voucher row";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  // Archive / restore. The row's new state is the opposite of the current
  // view, so it leaves the visible list either way — drop it optimistically,
  // decrement the page total, and subtract its amounts from the summary row.
  const handleArchive = useCallback(
    async (e: VoucherEntry) => {
      try {
        await archiveVoucherEntry(e.id);
        setEntries((prev) => prev.filter((x) => x.id !== e.id));
        setTotalCount((c) => Math.max(0, c - 1));
        setTotals((t) => ({
          redeemed: t.redeemed - e.redeemed,
          issued: t.issued - e.issued,
          refund: t.refund - e.refund,
        }));
        toast.success("Voucher row archived");
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to archive row",
        );
      }
    },
    [setTotalCount],
  );

  const handleUnarchive = useCallback(
    async (e: VoucherEntry) => {
      try {
        await unarchiveVoucherEntry(e.id);
        setEntries((prev) => prev.filter((x) => x.id !== e.id));
        setTotalCount((c) => Math.max(0, c - 1));
        setTotals((t) => ({
          redeemed: t.redeemed - e.redeemed,
          issued: t.issued - e.issued,
          refund: t.refund - e.refund,
        }));
        toast.success("Voucher row restored");
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to restore row",
        );
      }
    },
    [setTotalCount],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Voucher CRM" subtitle="Per-partner voucher ledger">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                <Download className="size-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-3.5" />
              Import
            </Button>
          ) : null}
          {canCreate ? (
            <PermissionButton
              permission="voucher-crm:create"
              onClick={handleCreate}
            >
              <Plus className="size-4" />
              Add partner
            </PermissionButton>
          ) : null}
        </div>
      </PageHeader>

      <Tabs
        tabs={[
          { id: "active", label: "Active" },
          { id: "archived", label: "Archived" },
        ]}
        active={archived ? "archived" : "active"}
        onChange={(v) => {
          setArchived(v === "archived");
          setPage(1);
        }}
      />

      <div className="relative max-w-sm">
        <Search
          className={`
            text-muted-foreground absolute top-1/2 left-2.5 size-4
            -translate-y-1/2
          `}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search partner or country..."
          className="h-8 pl-8 text-xs"
        />
      </div>

      {!reorderEnabled && (debouncedSearch.trim() || archived) ? (
        <p className="text-muted-foreground text-[11px]">
          {archived
            ? "Drag-to-reorder is disabled in the Archived view."
            : "Drag-to-reorder is disabled while a search is active."}
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Table
          // table-fixed makes the per-column widths authoritative so
          // drag-to-resize sticks (Notion-style).
          className="table-fixed"
          containerClassName={`
            max-h-[60svh] md:max-h-[calc(100vh-280px)] overflow-auto rounded-lg border
          `}
        >
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-[36px]" />
              <SortableContext
                items={colOrder}
                strategy={horizontalListSortingStrategy}
              >
                {colOrder.map((key) => (
                  <SortableColumnHead
                    key={key}
                    colKey={key}
                    label={VOU_COL_META[key].label}
                    className={VOU_COL_META[key].headClassName}
                    width={widths[key]}
                    onResize={(k, w) => setWidth(k as VouColKey, w)}
                  />
                ))}
              </SortableContext>
              {/* Auto-width spacer — under table-fixed it's the only
                  width-less column, so it absorbs the leftover table
                  width (data columns keep their resized widths, slack
                  sits before the actions column). */}
              <TableHead />
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              skeletonRows.map((i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell colSpan={colOrder.length + 3}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colOrder.length + 3}
                  className="text-muted-foreground py-10 text-center text-xs"
                >
                  No voucher rows yet
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={entries.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                {entries.map((e, index) => (
                  <SortableVoucherRow
                    key={e.id}
                    entry={e}
                    index={(page - 1) * pageSize + index + 1}
                    colOrder={colOrder}
                    canDrag={reorderEnabled}
                    canManage={canManage}
                    canDelete={canDelete}
                    isArchivedView={archived}
                    onEdit={() => handleEdit(e)}
                    onArchive={() => void handleArchive(e)}
                    onUnarchive={() => void handleUnarchive(e)}
                    onDelete={() => setDeleteTarget(e)}
                  />
                ))}
              </SortableContext>
            )}
            {!loading && entries.length > 0 ? (
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell />
                {colOrder.map((key) => {
                  if (key === "partner") {
                    return (
                      <TableCell key={key} className="text-xs">
                        Total
                      </TableCell>
                    );
                  }
                  if (VOU_COL_META[key].numeric) {
                    return (
                      <TableCell
                        key={key}
                        className="text-right text-xs tabular-nums"
                      >
                        {totals[key as keyof VoucherTotals]}
                      </TableCell>
                    );
                  }
                  return <TableCell key={key} />;
                })}
                <TableCell />
                <TableCell />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </DndContext>

      <div className="mt-3">
        <DataPagination
          page={page}
          pageSize={pageSize}
          totalCount={pagination.totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <VoucherCrmFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editing}
        onSaved={handleSaved}
      />

      <CrmImportDialog<CreateVoucherEntryInput>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleSaved}
        title="Import voucher rows"
        entityLabel="rows"
        templateName="voucher-import-template"
        fields={[
          {
            key: "partner",
            headers: ["Partner"],
            type: "string",
            required: true,
          },
          { key: "country", headers: ["Country"], type: "string" },
          { key: "redeemed", headers: ["Redeemed"], type: "number" },
          { key: "issued", headers: ["Issued"], type: "number" },
          { key: "refund", headers: ["Refund"], type: "number" },
        ]}
        submit={async (rows) => {
          const res = await importVoucherEntries(rows);
          return res.data;
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete voucher row?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing{" "}
              <span className="font-medium">{deleteTarget?.partner}</span> from
              the voucher ledger. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => {
                ev.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableVoucherRow({
  entry,
  index,
  colOrder,
  canDrag,
  canManage,
  canDelete,
  isArchivedView,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  entry: VoucherEntry;
  index: number;
  colOrder: VouColKey[];
  canDrag: boolean;
  canManage: boolean;
  canDelete: boolean;
  isArchivedView: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: !canDrag });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-muted/40" : "hover:bg-muted/40"}
    >
      <TableCell className="w-[36px]">
        <button
          type="button"
          aria-label="Drag to reorder"
          disabled={!canDrag}
          className={`
            text-muted-foreground inline-flex size-6 items-center justify-center
            rounded transition-colors
            hover:text-foreground
            disabled:cursor-not-allowed disabled:opacity-30
            ${
              canDrag
                ? `
                  cursor-grab
                  active:cursor-grabbing
                `
                : ""
            }
          `}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      </TableCell>
      {colOrder.map((key) => {
        switch (key) {
          case "rownum":
            return (
              <TableCell key={key} className="text-muted-foreground text-xs">
                {index}
              </TableCell>
            );
          case "partner":
            return (
              <TableCell key={key} className="truncate text-xs font-medium">
                {entry.partner}
              </TableCell>
            );
          case "country":
            return (
              <TableCell key={key} className="truncate text-xs">
                {entry.country ?? "—"}
              </TableCell>
            );
          case "redeemed":
            return (
              <TableCell key={key} className="text-right text-xs tabular-nums">
                {entry.redeemed}
              </TableCell>
            );
          case "issued":
            return (
              <TableCell key={key} className="text-right text-xs tabular-nums">
                {entry.issued}
              </TableCell>
            );
          case "refund":
            return (
              <TableCell key={key} className="text-right text-xs tabular-nums">
                {entry.refund}
              </TableCell>
            );
          default:
            return null;
        }
      })}
      {/* Flex spacer — pairs with the w-full header so data columns pack left. */}
      <TableCell />
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage ? (
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="size-3.5" />
                Edit
              </DropdownMenuItem>
            ) : null}
            {canManage ? (
              isArchivedView ? (
                <DropdownMenuItem onClick={onUnarchive}>
                  <ArchiveRestore className="size-3.5" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="size-3.5" />
                  Archive
                </DropdownMenuItem>
              )
            ) : null}
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
