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
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ProductCrmFormDialog } from "@/components/product-crm/product-crm-form-dialog";
import { Badge } from "@/components/shared/badge";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
import { DataPagination } from "@/components/shared/data-pagination";
import { ExpandableText } from "@/components/shared/expandable-text";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { SortableColumnHead } from "@/components/shared/sortable-column-head";
import { useColumnOrder } from "@/components/shared/use-column-order";
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
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  type CreateProductProjectInput,
  deleteProductProject,
  importProductProjects,
  listProductProjects,
  type ProductProject,
  reorderProductProjects,
} from "@/services/product-crm.service";

const STATUS_OPTIONS = [
  { value: "not_yet_started", label: "Not Yet Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "uat", label: "UAT" },
  { value: "staging_integrated", label: "Staging Integrated" },
  { value: "prod_integrated", label: "Prod. Integrated" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label]),
);

const STATUS_VARIANTS: Record<
  string,
  "green" | "amber" | "red" | "gold" | "blue" | "grey" | "purple" | "teal"
> = {
  not_yet_started: "grey",
  in_progress: "blue",
  uat: "amber",
  staging_integrated: "purple",
  prod_integrated: "teal",
  on_hold: "red",
  completed: "green",
};

// Reorderable column registry — drag handle + kebab stay pinned at the
// edges; the columns between are user-rearrangeable, persisted to
// localStorage via useColumnOrder.
type ProdColKey =
  | "rownum"
  | "name"
  | "status"
  | "owner"
  | "golive"
  | "revGolive"
  | "dependency"
  | "comment";

const PROD_COL_STORAGE_KEY = "product-crm-col-order-v1";

const PROD_COL_DEFAULT_ORDER: readonly ProdColKey[] = [
  "rownum",
  "name",
  "status",
  "owner",
  "golive",
  "revGolive",
  "dependency",
  "comment",
];

// Widths live in PROD_COL_DEFAULT_WIDTHS (drag-to-resize, table-fixed);
// headClassName carries only alignment, never width.
const PROD_COL_META: Record<
  ProdColKey,
  { label: string; headClassName?: string }
> = {
  rownum: { label: "#" },
  name: { label: "Project" },
  status: { label: "Status" },
  owner: { label: "Owner" },
  golive: { label: "GoLive" },
  revGolive: { label: "Rev. GoLive" },
  dependency: { label: "Dependency" },
  comment: { label: "Comment" },
};

const PROD_COL_WIDTH_STORAGE_KEY = "product-crm-col-width-v1";
const PROD_COL_DEFAULT_WIDTHS: Record<ProdColKey, number> = {
  rownum: 48,
  name: 280,
  status: 160,
  owner: 140,
  golive: 120,
  revGolive: 120,
  dependency: 140,
  comment: 240,
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ProductCrmList() {
  const router = useRouter();
  const { user, hasAnyPermission } = useAuth();
  const canManageAny = hasAnyPermission(
    "product-crm:update",
    "product-crm:manage",
    "projects:update",
    "projects:manage",
  );
  const canDeleteAny = hasAnyPermission(
    "product-crm:delete",
    "product-crm:manage",
    "projects:delete",
    "projects:manage",
  );

  const [projects, setProjects] = useState<ProductProject[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const pagination = usePagination();
  const { page, pageSize, setPage, setPageSize, setTotalCount, totalPages } =
    pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { colOrder, isColumnId, reorderColumns } = useColumnOrder(
    PROD_COL_STORAGE_KEY,
    PROD_COL_DEFAULT_ORDER,
  );
  const { widths, setWidth } = useColumnWidths(
    PROD_COL_WIDTH_STORAGE_KEY,
    PROD_COL_DEFAULT_WIDTHS,
  );

  // Drag-to-reorder is disabled while a filter / search is active so a
  // partial view can't corrupt the global ordering.
  const reorderEnabled = useMemo(
    () => !debouncedSearch.trim() && !statusFilter && !loading,
    [debouncedSearch, statusFilter, loading],
  );
  const prePersistOrder = useRef<ProductProject[] | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listProductProjects({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      });
      setProjects(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load Product projects";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, setTotalCount]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, setPage]);

  // Owner picker — lean list via `/directory/assignable` (auth-only).
  useEffect(() => {
    listAssignableUsers({ limit: 500 })
      .then((res) => setUsers(res.data))
      .catch(() => {
        // Picker stays empty; form still saves with current user as owner.
      });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Header drag → column reorder. Column ids are short literals,
    // distinct from the project UUIDs used for row drag.
    if (isColumnId(active.id)) {
      if (isColumnId(over.id)) reorderColumns(active.id, over.id);
      return;
    }

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    prePersistOrder.current = projects;
    const next = arrayMove(projects, oldIndex, newIndex);
    setProjects(next);

    try {
      await reorderProductProjects(next.map((p) => p.id));
    } catch (err) {
      if (prePersistOrder.current) setProjects(prePersistOrder.current);
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to reorder Product projects";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const handleCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((p: ProductProject) => {
    setEditing(p);
    setFormOpen(true);
  }, []);

  const handleSaved = useCallback(
    (saved: ProductProject) => {
      if (editing) {
        setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        setTotalCount((c) => c + 1);
        if (page === 1) {
          setProjects((prev) => {
            const next = [saved, ...prev];
            return next.length > pageSize ? next.slice(0, pageSize) : next;
          });
        }
      }
    },
    [editing, page, pageSize, setTotalCount],
  );

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(true);
      try {
        const res = await listProductProjects({
          page: 1,
          limit: 500,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
        });
        if (res.data.length === 0) {
          toast.error("Nothing to export");
          return;
        }
        exportRows(
          "product-crm",
          [
            { header: "Project", value: (r: ProductProject) => r.name },
            { header: "Status", value: (r: ProductProject) => r.status },
            {
              header: "Owner",
              value: (r: ProductProject) => r.owner?.name ?? "",
            },
            {
              header: "GoLive",
              value: (r: ProductProject) => r.goLiveDate ?? "",
            },
            {
              header: "Rev. GoLive",
              value: (r: ProductProject) => r.revisedGoLiveDate ?? "",
            },
            {
              header: "Dependency",
              value: (r: ProductProject) => r.dependency ?? "",
            },
            {
              header: "Comment",
              value: (r: ProductProject) => r.comment ?? "",
            },
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
    [debouncedSearch, statusFilter],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProductProject(deleteTarget.id);
      toast.success("Product project deleted");
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeleteTarget(null);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete project";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Product CRM"
        subtitle="Every project owned by the Product team"
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
              <DropdownMenuItem onClick={() => void handleExport("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PermissionButton
            variant="outline"
            permission="product-crm:create"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-3.5" />
            Import
          </PermissionButton>
          <PermissionButton
            variant="accent"
            permission="product-crm:create"
            onClick={handleCreate}
          >
            <Plus className="size-3.5" />
            New project
          </PermissionButton>
        </div>
      </PageHeader>

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
            placeholder="Search Product projects..."
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
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!reorderEnabled && (debouncedSearch.trim() || statusFilter) ? (
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
            max-h-[calc(100vh-280px)] overflow-auto rounded-lg border
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
                    label={PROD_COL_META[key].label}
                    className={PROD_COL_META[key].headClassName}
                    width={widths[key]}
                    onResize={(k, w) => setWidth(k as ProdColKey, w)}
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
                  <TableCell colSpan={colOrder.length + 3}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colOrder.length + 3}
                  className="text-muted-foreground py-10 text-center text-xs"
                >
                  No Product projects found
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={projects.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {projects.map((p, index) => (
                  <SortableItRow
                    key={p.id}
                    project={p}
                    index={(page - 1) * pageSize + index + 1}
                    colOrder={colOrder}
                    canDrag={reorderEnabled}
                    canManageRow={p.ownerId === user?.id || canManageAny}
                    canDelete={canDeleteAny}
                    onView={() => router.push(`/projects/${p.id}`)}
                    onEdit={() => handleEdit(p)}
                    onDelete={() => setDeleteTarget(p)}
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

      <ProductCrmFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        users={users}
        project={editing}
        onSaved={handleSaved}
      />

      <CrmImportDialog<CreateProductProjectInput>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void fetchProjects()}
        title="Import Product projects"
        entityLabel="projects"
        templateName="product-crm-import-template"
        fields={[
          {
            key: "name",
            headers: ["Project", "Name"],
            type: "string",
            required: true,
          },
          { key: "status", headers: ["Status"], type: "string" },
          { key: "dependency", headers: ["Dependency"], type: "string" },
          { key: "comment", headers: ["Comment"], type: "string" },
        ]}
        submit={async (rows) => {
          const res = await importProductProjects(rows);
          return res.data;
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product project?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <span className="font-medium">{deleteTarget?.name}</span>{" "}
              removes its tasks, comments, columns, and member assignments. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
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

function SortableItRow({
  project,
  index,
  colOrder,
  canDrag,
  canManageRow,
  canDelete,
  onView,
  onEdit,
  onDelete,
}: {
  project: ProductProject;
  index: number;
  colOrder: ProdColKey[];
  canDrag: boolean;
  canManageRow: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: !canDrag });

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
          case "name":
            return (
              <TableCell key={key} className="max-w-[420px]">
                <button
                  type="button"
                  onClick={onView}
                  className={`
                    truncate text-left text-xs font-medium
                    hover:underline
                  `}
                >
                  {project.name}
                </button>
                {project.description ? (
                  <ExpandableText text={project.description} max={200} />
                ) : null}
              </TableCell>
            );
          case "status":
            return (
              <TableCell key={key}>
                <Badge variant={STATUS_VARIANTS[project.status] ?? "grey"}>
                  {STATUS_LABELS[project.status] ?? project.status}
                </Badge>
              </TableCell>
            );
          case "owner":
            return (
              <TableCell key={key} className="text-xs">
                {project.owner?.name ?? "—"}
              </TableCell>
            );
          case "golive":
            return (
              <TableCell key={key} className="text-xs">
                {formatDate(project.goLiveDate)}
              </TableCell>
            );
          case "revGolive":
            return (
              <TableCell key={key} className="text-xs">
                {formatDate(project.revisedGoLiveDate)}
              </TableCell>
            );
          case "dependency":
            return (
              <TableCell key={key} className="text-xs">
                {project.dependency ?? "—"}
              </TableCell>
            );
          case "comment":
            return (
              <TableCell
                key={key}
                className="text-muted-foreground line-clamp-2 text-[11px]"
              >
                {project.comment ?? "—"}
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
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="size-3.5" />
              View
            </DropdownMenuItem>
            {canManageRow ? (
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="size-3.5" />
                Edit
              </DropdownMenuItem>
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
