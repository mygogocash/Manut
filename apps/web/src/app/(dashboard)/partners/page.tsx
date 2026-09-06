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
  Download,
  Edit,
  Eye,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DeletePartnerDialog } from "@/components/partners/delete-partner-dialog";
import { MarketingCrmTabs } from "@/components/partners/marketing-crm-tabs";
import { PartnerFormDialog } from "@/components/partners/partner-form-dialog";
import { Badge } from "@/components/shared/badge";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { SortableColumnHead } from "@/components/shared/sortable-column-head";
import { useColumnOrder } from "@/components/shared/use-column-order";
import { useColumnWidths } from "@/components/shared/use-column-widths";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { type ExportFormat, exportRows } from "@/lib/crm-export";
import { useAuth } from "@/providers/auth-provider";
import {
  type CreatePartnerInput,
  exportPartnerTasks,
  importPartners,
  type ImportPartnerTaskRow,
  importPartnerTasks,
  listPartners,
  type Partner,
  PARTNER_DEPARTMENT_OPTIONS,
  PARTNER_STATUS_LABELS,
  PARTNER_STATUSES,
  PARTNER_TYPE_LABELS,
  type PartnerDepartment,
  type PartnerTaskExportRow,
  reorderPartners,
  updatePartner,
} from "@/services/partner.service";

// Reorderable + resizable column registry. Drag handle + kebab stay
// pinned at the edges; the columns between rearrange (header drag) and
// resize (right-edge drag), persisted to localStorage. Widths live in
// PART_COL_DEFAULT_WIDTHS (table-fixed); meta carries labels only.
type PartColKey =
  | "rownum"
  | "company"
  | "status"
  | "pastCampaign"
  | "nextCampaign"
  | "dependency"
  | "comment"
  | "department"
  | "owner";

// Bumped to v2 when the GoLive date columns were replaced by the two
// campaign-date columns, so saved orders/widths referencing the old keys
// reset cleanly instead of pinning dead columns.
const PART_COL_ORDER_STORAGE_KEY = "partner-crm-col-order-v2";
const PART_COL_WIDTH_STORAGE_KEY = "partner-crm-col-width-v2";

const PART_COL_DEFAULT_ORDER: readonly PartColKey[] = [
  "rownum",
  "company",
  "status",
  "pastCampaign",
  "nextCampaign",
  "dependency",
  "comment",
  "department",
  "owner",
];

const PART_COL_META: Record<PartColKey, { label: string }> = {
  rownum: { label: "#" },
  company: { label: "Company" },
  status: { label: "Status" },
  pastCampaign: { label: "Previous campaign" },
  nextCampaign: { label: "Next campaign" },
  dependency: { label: "Dependency" },
  comment: { label: "Comment" },
  department: { label: "Department" },
  owner: { label: "Owner" },
};

const PART_COL_DEFAULT_WIDTHS: Record<PartColKey, number> = {
  rownum: 48,
  company: 220,
  status: 140,
  pastCampaign: 160,
  nextCampaign: 160,
  dependency: 140,
  comment: 240,
  department: 160,
  owner: 140,
};

export default function PartnersPage() {
  const router = useRouter();
  const { user, hasAnyPermission } = useAuth();
  const canManageAny = hasAnyPermission("partners:update");
  const canDeleteAny = hasAnyPermission("partners:delete");

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");

  const pagination = usePagination();
  const { page, pageSize, setPage, setPageSize, setTotalCount, totalPages } =
    pagination;

  // Drag-to-reorder is disabled while a filter / search is active so a
  // partial view can't corrupt the global ordering.
  const reorderEnabled = useMemo(
    () =>
      !debouncedSearch.trim() && !statusFilter && !departmentFilter && !loading,
    [debouncedSearch, statusFilter, departmentFilter, loading],
  );
  const prePersistOrder = useRef<Partner[] | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importTasksOpen, setImportTasksOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { colOrder, isColumnId, reorderColumns } = useColumnOrder(
    PART_COL_ORDER_STORAGE_KEY,
    PART_COL_DEFAULT_ORDER,
  );
  const { widths, setWidth } = useColumnWidths(
    PART_COL_WIDTH_STORAGE_KEY,
    PART_COL_DEFAULT_WIDTHS,
  );

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listPartners({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        department: (departmentFilter || undefined) as
          PartnerDepartment | undefined,
      });
      setPartners(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load partners";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    statusFilter,
    departmentFilter,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchPartners();
  }, [fetchPartners]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, departmentFilter, setPage]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Header drag → column reorder. Column ids are short literals,
    // distinct from the partner UUIDs used for row drag.
    if (isColumnId(active.id)) {
      if (isColumnId(over.id)) reorderColumns(active.id, over.id);
      return;
    }

    const oldIndex = partners.findIndex((p) => p.id === active.id);
    const newIndex = partners.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    prePersistOrder.current = partners;
    const next = arrayMove(partners, oldIndex, newIndex);
    setPartners(next);

    try {
      await reorderPartners(next.map((p) => p.id));
    } catch (err) {
      if (prePersistOrder.current) setPartners(prePersistOrder.current);
      const msg =
        err instanceof ApiError ? err.message : "Failed to reorder partners";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const handleCreate = useCallback(() => {
    setEditingPartner(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((p: Partner) => {
    setEditingPartner(p);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((p: Partner) => {
    setDeleteTarget(p);
    setDeleteOpen(true);
  }, []);

  // Inline campaign-date edit from the overview. Empty value clears the
  // date. Optimistic: patch local state immediately, revert on failure.
  const handleCampaignDateChange = useCallback(
    async (
      partnerId: string,
      field: "pastCampaignDate" | "nextCampaignDate",
      value: string,
    ) => {
      const next = value || null;
      let previous: string | null | undefined;
      setPartners((prev) =>
        prev.map((p) => {
          if (p.id !== partnerId) return p;
          previous = p[field];
          return { ...p, [field]: next };
        }),
      );
      try {
        await updatePartner(partnerId, { [field]: next });
      } catch (err) {
        setPartners((prev) =>
          prev.map((p) =>
            p.id === partnerId ? { ...p, [field]: previous ?? null } : p,
          ),
        );
        const msg =
          err instanceof ApiError ? err.message : "Failed to update date";
        toast.error(msg);
      }
    },
    [],
  );

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(true);
      try {
        const res = await listPartners({
          page: 1,
          limit: 500,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          department: (departmentFilter || undefined) as
            PartnerDepartment | undefined,
        });
        if (res.data.length === 0) {
          toast.error("Nothing to export");
          return;
        }
        exportRows(
          "partner-crm",
          [
            { header: "Company", value: (p: Partner) => p.company },
            { header: "Type", value: (p: Partner) => p.type },
            { header: "Status", value: (p: Partner) => p.status },
            { header: "Region", value: (p: Partner) => p.region ?? "" },
            { header: "Country", value: (p: Partner) => p.country ?? "" },
            { header: "Department", value: (p: Partner) => p.department ?? "" },
            {
              header: "Previous campaign",
              value: (p: Partner) => p.pastCampaignDate ?? "",
            },
            {
              header: "Next campaign",
              value: (p: Partner) => p.nextCampaignDate ?? "",
            },
            { header: "Dependency", value: (p: Partner) => p.dependency ?? "" },
            { header: "Comment", value: (p: Partner) => p.comment ?? "" },
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
    [debouncedSearch, statusFilter, departmentFilter],
  );

  const handleExportTasks = useCallback(
    async (format: ExportFormat) => {
      setExporting(true);
      try {
        const res = await exportPartnerTasks({
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          department: (departmentFilter || undefined) as
            PartnerDepartment | undefined,
        });
        if (res.data.length === 0) {
          toast.error("No tasks to export");
          return;
        }
        exportRows(
          "partner-tasks",
          [
            {
              header: "Partner",
              value: (r: PartnerTaskExportRow) => r.partner,
            },
            { header: "Task", value: (r: PartnerTaskExportRow) => r.title },
            {
              header: "Description",
              value: (r: PartnerTaskExportRow) => r.description,
            },
            { header: "Status", value: (r: PartnerTaskExportRow) => r.status },
            {
              header: "Priority",
              value: (r: PartnerTaskExportRow) => r.priority,
            },
            { header: "Owner", value: (r: PartnerTaskExportRow) => r.owner },
            {
              header: "Start Date",
              value: (r: PartnerTaskExportRow) => r.startDate,
            },
            {
              header: "End Date",
              value: (r: PartnerTaskExportRow) => r.endDate,
            },
            {
              header: "Parent Task",
              value: (r: PartnerTaskExportRow) => r.parentTitle,
            },
          ],
          res.data,
          format,
        );
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to export tasks";
        toast.error(msg);
      } finally {
        setExporting(false);
      }
    },
    [debouncedSearch, statusFilter, departmentFilter],
  );

  const handlePartnerSaved = useCallback(
    (saved: Partner) => {
      if (editingPartner) {
        setPartners((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        setTotalCount((c) => c + 1);
        if (page === 1) {
          setPartners((prev) => {
            const next = [saved, ...prev];
            return next.length > pageSize ? next.slice(0, pageSize) : next;
          });
        }
      }
    },
    [editingPartner, page, pageSize, setTotalCount],
  );

  const handlePartnerDeleted = useCallback(
    (deleted: Partner) => {
      setPartners((prev) => prev.filter((p) => p.id !== deleted.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeleteTarget(null);
    },
    [setTotalCount],
  );

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Marketing CRM"
        subtitle="Manage marketing campaigns and partner relationships"
      >
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                <Download className="size-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Partners</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void handleExport("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Tasks</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void handleExportTasks("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportTasks("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {hasAnyPermission("partners:create") ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="size-3.5" />
                  Import
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setImportOpen(true)}>
                  Partners
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportTasksOpen(true)}>
                  Tasks
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <PermissionButton
            variant="accent"
            permission="partners:create"
            onClick={handleCreate}
          >
            <Plus className="size-3.5" />
            Add partner
          </PermissionButton>
        </div>
      </PageHeader>

      <div className="mb-4">
        <MarketingCrmTabs />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partners..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-10 w-[180px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PARTNER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PARTNER_STATUS_LABELS[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={departmentFilter || "all"}
          onValueChange={(v) => setDepartmentFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-10 w-[200px] text-xs">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {PARTNER_DEPARTMENT_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!reorderEnabled &&
      (debouncedSearch.trim() || statusFilter || departmentFilter) ? (
        <p className="text-muted-foreground mb-2 text-[11px]">
          Drag-to-reorder is disabled while a filter or search is active.
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Table
          // table-fixed makes per-column widths authoritative for
          // drag-to-resize (Notion-style).
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
                    label={PART_COL_META[key].label}
                    width={widths[key]}
                    onResize={(k, w) => setWidth(k as PartColKey, w)}
                  />
                ))}
              </SortableContext>
              {/* Auto-width spacer absorbs leftover table width. */}
              <TableHead />
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              skeletonRows.map((i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell colSpan={13}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : partners.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="text-muted-foreground py-10 text-center text-xs"
                >
                  No partners found
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={partners.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {partners.map((p, index) => (
                  <SortablePartnerRow
                    key={p.id}
                    partner={p}
                    index={(page - 1) * pageSize + index + 1}
                    colOrder={colOrder}
                    canDrag={reorderEnabled}
                    canEdit={p.owner?.id === user?.id || canManageAny}
                    canManageRow={p.owner?.id === user?.id || canManageAny}
                    canDelete={canDeleteAny}
                    onView={() => router.push(`/partners/${p.slug}`)}
                    onEdit={() => handleEdit(p)}
                    onDelete={() => handleDelete(p)}
                    onCampaignDateChange={handleCampaignDateChange}
                  />
                ))}
              </SortableContext>
            )}
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

      <PartnerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        partner={editingPartner}
        onSaved={handlePartnerSaved}
      />

      <CrmImportDialog<CreatePartnerInput>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void fetchPartners()}
        title="Import partners"
        entityLabel="partners"
        templateName="partner-crm-import-template"
        fields={[
          {
            key: "company",
            headers: ["Company", "Name"],
            type: "string",
            required: true,
          },
          { key: "type", headers: ["Type"], type: "string" },
          { key: "status", headers: ["Status"], type: "string" },
          { key: "region", headers: ["Region"], type: "string" },
          { key: "country", headers: ["Country"], type: "string" },
          { key: "department", headers: ["Department"], type: "string" },
          { key: "comment", headers: ["Comment"], type: "string" },
        ]}
        submit={async (rows) => {
          // `type` is required server-side; default blanks to "Other"
          // so a partial spreadsheet still imports.
          const normalised = rows.map((r) => ({
            ...r,
            type: (r.type as string | null)?.trim() || "Other",
          }));
          const res = await importPartners(normalised);
          return res.data;
        }}
      />

      <CrmImportDialog<ImportPartnerTaskRow>
        open={importTasksOpen}
        onOpenChange={setImportTasksOpen}
        onImported={() => void fetchPartners()}
        title="Import partner tasks"
        entityLabel="tasks"
        templateName="partner-tasks-import-template"
        fields={[
          {
            key: "partner",
            headers: ["Partner", "Company"],
            type: "string",
            required: true,
          },
          {
            key: "title",
            headers: ["Task", "Title"],
            type: "string",
            required: true,
          },
          { key: "description", headers: ["Description"], type: "string" },
          { key: "status", headers: ["Status"], type: "string" },
          { key: "priority", headers: ["Priority"], type: "string" },
          {
            key: "startDate",
            headers: ["Start Date", "Start"],
            type: "string",
          },
          { key: "endDate", headers: ["End Date", "End"], type: "string" },
          {
            key: "parentTitle",
            headers: ["Parent Task", "Parent"],
            type: "string",
          },
        ]}
        submit={async (rows) => {
          const res = await importPartnerTasks(rows);
          return res.data;
        }}
      />

      <DeletePartnerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        partner={deleteTarget}
        onDeleted={handlePartnerDeleted}
      />
    </div>
  );
}

function SortablePartnerRow({
  partner,
  index,
  colOrder,
  canDrag,
  canEdit,
  canManageRow,
  canDelete,
  onView,
  onEdit,
  onDelete,
  onCampaignDateChange,
}: {
  partner: Partner;
  index: number;
  colOrder: PartColKey[];
  canDrag: boolean;
  canEdit: boolean;
  canManageRow: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCampaignDateChange: (
    partnerId: string,
    field: "pastCampaignDate" | "nextCampaignDate",
    value: string,
  ) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: partner.id, disabled: !canDrag });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-muted/40" : undefined}
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
              <TableCell key={key}>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {index}
                </span>
              </TableCell>
            );
          case "company":
            return (
              <TableCell key={key}>
                <Link
                  href={`/partners/${partner.slug}`}
                  className={`
                    hover:text-primary
                    group block
                  `}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <span
                    className={`
                      block truncate font-medium
                      group-hover:underline
                    `}
                  >
                    {partner.company}
                  </span>
                  <p
                    className={`
                      text-muted-foreground mt-0.5 truncate text-[11px]
                    `}
                  >
                    {PARTNER_TYPE_LABELS[partner.type] ?? partner.type}
                  </p>
                </Link>
              </TableCell>
            );
          case "status":
            return (
              <TableCell key={key}>
                <Badge status={partner.status}>
                  {PARTNER_STATUS_LABELS[partner.status] ?? partner.status}
                </Badge>
              </TableCell>
            );
          case "pastCampaign":
            return (
              <TableCell key={key}>
                <div onClick={(e) => e.stopPropagation()}>
                  <FormDatePicker
                    value={partner.pastCampaignDate?.slice(0, 10) ?? ""}
                    onChange={(val) =>
                      onCampaignDateChange(partner.id, "pastCampaignDate", val)
                    }
                    disabled={!canEdit}
                    className="h-7 text-xs"
                  />
                </div>
              </TableCell>
            );
          case "nextCampaign":
            return (
              <TableCell key={key}>
                <div onClick={(e) => e.stopPropagation()}>
                  <FormDatePicker
                    value={partner.nextCampaignDate?.slice(0, 10) ?? ""}
                    onChange={(val) =>
                      onCampaignDateChange(partner.id, "nextCampaignDate", val)
                    }
                    disabled={!canEdit}
                    className="h-7 text-xs"
                  />
                </div>
              </TableCell>
            );
          case "dependency":
            return (
              <TableCell key={key}>
                <span
                  className={`text-foreground-secondary block truncate text-xs`}
                >
                  {partner.dependency || "—"}
                </span>
              </TableCell>
            );
          case "comment":
            return (
              <TableCell key={key} className="align-top">
                <span
                  className={`
                    text-foreground-secondary line-clamp-2 block text-xs
                    break-words whitespace-normal
                  `}
                  title={partner.comment ?? undefined}
                >
                  {partner.comment || "—"}
                </span>
              </TableCell>
            );
          case "department":
            return (
              <TableCell key={key}>
                <span className="text-foreground-secondary text-xs">
                  {partner.department || "—"}
                </span>
              </TableCell>
            );
          case "owner":
            return (
              <TableCell key={key}>
                <span className="text-foreground-secondary text-xs">
                  {partner.owner?.name ?? "—"}
                </span>
              </TableCell>
            );
          default:
            return null;
        }
      })}
      <TableCell />
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="mr-2 size-3.5" />
              View
            </DropdownMenuItem>
            {canManageRow && (
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 size-3.5" />
                Edit
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={`
                    text-destructive
                    focus:text-destructive
                  `}
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
