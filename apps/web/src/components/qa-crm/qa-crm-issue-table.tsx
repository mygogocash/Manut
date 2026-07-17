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
  ArrowLeft,
  Download,
  Edit,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { QaCrmTaskDialog } from "@/components/qa-crm/qa-crm-task-dialog";
import { Badge } from "@/components/shared/badge";
import { CrmImportDialog } from "@/components/shared/crm-import-dialog";
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
import { ApiError } from "@/lib/api-client";
import { type ExportFormat, exportRows } from "@/lib/crm-export";
import { useAuth } from "@/providers/auth-provider";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  type CreateQaProjectTaskInput,
  deleteQaTask,
  getQaProject,
  getQaProjectBoard,
  importQaTasks,
  type QaPriority,
  type QaProject,
  type QaProjectTask,
  type QaTaskStatus,
  reorderQaTasks,
} from "@/services/qa-crm.service";

// Reorderable + resizable issue columns. Drag handle + kebab stay
// pinned at the edges; widths live in QA_ISSUE_COL_DEFAULT_WIDTHS
// (table-fixed) so drag-to-resize sticks.
type QaIssueColKey =
  | "date"
  | "partner"
  | "product"
  | "issueType"
  | "observation"
  | "expectation"
  | "priority"
  | "status"
  | "eta"
  | "comment";

const QA_ISSUE_COL_ORDER_STORAGE_KEY = "qa-issue-col-order-v1";
const QA_ISSUE_COL_WIDTH_STORAGE_KEY = "qa-issue-col-width-v1";

const QA_ISSUE_COL_DEFAULT_ORDER: readonly QaIssueColKey[] = [
  "date",
  "partner",
  "product",
  "issueType",
  "observation",
  "expectation",
  "priority",
  "status",
  "eta",
  "comment",
];

const QA_ISSUE_COL_META: Record<QaIssueColKey, { label: string }> = {
  date: { label: "Date" },
  partner: { label: "Partner" },
  product: { label: "Product" },
  issueType: { label: "Issue type" },
  observation: { label: "Observation" },
  expectation: { label: "Expectation" },
  priority: { label: "Priority" },
  status: { label: "Status" },
  eta: { label: "ETA" },
  comment: { label: "Comment" },
};

const QA_ISSUE_COL_DEFAULT_WIDTHS: Record<QaIssueColKey, number> = {
  date: 110,
  partner: 140,
  product: 120,
  issueType: 120,
  observation: 280,
  expectation: 240,
  priority: 80,
  status: 110,
  eta: 110,
  comment: 240,
};

const PRIORITY_VARIANTS: Record<QaPriority, "red" | "amber" | "blue"> = {
  P0: "red",
  P1: "amber",
  P2: "blue",
};

const STATUS_VARIANTS: Record<
  QaTaskStatus,
  "blue" | "amber" | "purple" | "green"
> = {
  open: "blue",
  clarified: "amber",
  exception: "purple",
  closed: "green",
};

const STATUS_LABELS: Record<QaTaskStatus, string> = {
  open: "Open",
  clarified: "Clarified",
  exception: "Exception",
  closed: "Closed",
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

interface Props {
  projectId: string;
}

export function QaCrmIssueTable({ projectId }: Props) {
  const { user, hasAnyPermission } = useAuth();
  const canManageAny = hasAnyPermission("qa-crm:update", "qa-crm:manage");
  const canDeleteAny = hasAnyPermission("qa-crm:delete", "qa-crm:manage");

  const [project, setProject] = useState<(QaProject & { role: string }) | null>(
    null,
  );
  const [tasks, setTasks] = useState<QaProjectTask[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<QaProjectTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QaProjectTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { colOrder, isColumnId, reorderColumns } = useColumnOrder(
    QA_ISSUE_COL_ORDER_STORAGE_KEY,
    QA_ISSUE_COL_DEFAULT_ORDER,
  );
  const { widths, setWidth } = useColumnWidths(
    QA_ISSUE_COL_WIDTH_STORAGE_KEY,
    QA_ISSUE_COL_DEFAULT_WIDTHS,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const prePersistOrder = useRef<QaProjectTask[] | null>(null);

  function handleExport(format: ExportFormat) {
    if (tasks.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    exportRows(
      "qa-issues",
      [
        { header: "Date", value: (t: QaProjectTask) => t.issueDate ?? "" },
        { header: "Partner", value: (t: QaProjectTask) => t.partner ?? "" },
        { header: "Product", value: (t: QaProjectTask) => t.product ?? "" },
        {
          header: "Issue type",
          value: (t: QaProjectTask) => t.issueType ?? "",
        },
        { header: "Title", value: (t: QaProjectTask) => t.title },
        {
          header: "Observation",
          value: (t: QaProjectTask) => t.observation ?? "",
        },
        {
          header: "Expectation",
          value: (t: QaProjectTask) => t.expectation ?? "",
        },
        { header: "Priority", value: (t: QaProjectTask) => t.priority },
        { header: "Status", value: (t: QaProjectTask) => t.status },
        { header: "ETA", value: (t: QaProjectTask) => t.eta ?? "" },
        { header: "Comment", value: (t: QaProjectTask) => t.qaComment ?? "" },
      ],
      tasks,
      format,
    );
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [proj, board] = await Promise.all([
        getQaProject(projectId),
        getQaProjectBoard(projectId),
      ]);
      setProject(proj.data);
      setTasks(board.data.tasks);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load QA project";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    listAssignableUsers({ limit: 500 })
      .then((res) => setUsers(res.data))
      .catch(() => {
        // Picker stays empty; backend defaults to current user.
      });
  }, []);

  const productOptions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.product?.trim()) set.add(t.product.trim());
    });
    return Array.from(set).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (productFilter && t.product !== productFilter) return false;
      if (q) {
        const haystack = [
          t.title,
          t.partner,
          t.product,
          t.issueType,
          t.observation,
          t.expectation,
          t.qaComment,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, debouncedSearch, statusFilter, priorityFilter, productFilter]);

  // Row drag persists a global order, so disable it while a filter or
  // search narrows the list (a partial view can't safely reorder all).
  const reorderEnabled =
    !debouncedSearch.trim() &&
    !statusFilter &&
    !priorityFilter &&
    !productFilter &&
    !loading;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Header drag → column reorder (short literal ids, distinct from
    // the task UUIDs used for row drag).
    if (isColumnId(active.id)) {
      if (isColumnId(over.id)) reorderColumns(active.id, over.id);
      return;
    }

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    prePersistOrder.current = tasks;
    const next = arrayMove(tasks, oldIndex, newIndex);
    setTasks(next);
    try {
      await reorderQaTasks(
        projectId,
        next.map((t) => t.id),
      );
    } catch (err) {
      if (prePersistOrder.current) setTasks(prePersistOrder.current);
      const msg =
        err instanceof ApiError ? err.message : "Failed to reorder issues";
      toast.error(msg);
    } finally {
      prePersistOrder.current = null;
    }
  }

  const handleCreate = useCallback(() => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  }, []);

  const handleEdit = useCallback((t: QaProjectTask) => {
    setEditingTask(t);
    setTaskDialogOpen(true);
  }, []);

  const handleSaved = useCallback(
    (saved: QaProjectTask) => {
      if (editingTask) {
        setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      } else {
        setTasks((prev) => [saved, ...prev]);
      }
    },
    [editingTask],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQaTask(projectId, deleteTarget.id);
      toast.success("Issue deleted");
      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete issue";
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
      <div className="mb-2">
        <Link
          href="/qa-crm"
          className={`
            text-muted-foreground inline-flex items-center gap-1 text-xs
            hover:underline
          `}
        >
          <ArrowLeft className="size-3" />
          Back to QA projects
        </Link>
      </div>

      <PageHeader
        title={project?.name ?? "QA Project"}
        subtitle={project?.description ?? "QA issue log"}
      >
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="size-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PermissionButton
            variant="outline"
            permission="qa-crm:update"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-3.5" />
            Import
          </PermissionButton>
          <PermissionButton
            variant="accent"
            permission="qa-crm:update"
            onClick={handleCreate}
          >
            <Plus className="size-3.5" />
            New issue
          </PermissionButton>
        </div>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm min-w-[240px] flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, observation, comment..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-10 w-[150px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="clarified">Clarified</SelectItem>
            <SelectItem value="exception">Exception</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter || "all"}
          onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-10 w-[140px] text-xs">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="P0">P0</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
          </SelectContent>
        </Select>
        {productOptions.length > 0 ? (
          <Select
            value={productFilter || "all"}
            onValueChange={(v) => setProductFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-10 w-[160px] text-xs">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {productOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {!reorderEnabled &&
      (debouncedSearch.trim() ||
        statusFilter ||
        priorityFilter ||
        productFilter) ? (
        <p className="text-muted-foreground mb-2 text-[11px]">
          Drag-to-reorder rows is disabled while a filter or search is active.
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Table
          // table-fixed makes per-column widths authoritative for
          // drag-to-resize (Notion-style).
          className="table-fixed"
          containerClassName={`
            max-h-[calc(100vh-300px)] overflow-auto rounded-lg border
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
                    label={QA_ISSUE_COL_META[key].label}
                    width={widths[key]}
                    onResize={(k, w) => setWidth(k as QaIssueColKey, w)}
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
            ) : filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="text-muted-foreground py-10 text-center text-xs"
                >
                  {tasks.length === 0
                    ? "No QA issues yet — create the first one."
                    : "No issues match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={filteredTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredTasks.map((t) => (
                  <SortableQaIssueRow
                    key={t.id}
                    task={t}
                    colOrder={colOrder}
                    canDrag={reorderEnabled}
                    canManageRow={t.ownerId === user?.id || canManageAny}
                    canDelete={canDeleteAny}
                    onEdit={() => handleEdit(t)}
                    onDelete={() => setDeleteTarget(t)}
                  />
                ))}
              </SortableContext>
            )}
          </TableBody>
        </Table>
      </DndContext>

      <QaCrmTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        projectId={projectId}
        users={users}
        task={editingTask}
        onSaved={handleSaved}
      />

      <CrmImportDialog<CreateQaProjectTaskInput>
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void fetchData()}
        title="Import QA issues"
        entityLabel="issues"
        templateName="qa-issues-import-template"
        fields={[
          {
            key: "title",
            headers: ["Title", "Issue"],
            type: "string",
            required: true,
          },
          { key: "partner", headers: ["Partner"], type: "string" },
          { key: "product", headers: ["Product"], type: "string" },
          {
            key: "issueType",
            headers: ["Issue type", "Issue Type"],
            type: "string",
          },
          { key: "observation", headers: ["Observation"], type: "string" },
          { key: "expectation", headers: ["Expectation"], type: "string" },
          { key: "eta", headers: ["ETA"], type: "string" },
          { key: "qaComment", headers: ["Comment"], type: "string" },
        ]}
        submit={async (rows) => {
          const res = await importQaTasks(projectId, rows);
          return res.data;
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete QA issue?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting{" "}
              <span className="font-medium">{deleteTarget?.title}</span> removes
              it and its comments. This cannot be undone.
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

function SortableQaIssueRow({
  task,
  colOrder,
  canDrag,
  canManageRow,
  canDelete,
  onEdit,
  onDelete,
}: {
  task: QaProjectTask;
  colOrder: QaIssueColKey[];
  canDrag: boolean;
  canManageRow: boolean;
  canDelete: boolean;
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
  } = useSortable({ id: task.id, disabled: !canDrag });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? "bg-muted/40 align-top"
          : `
            hover:bg-muted/40
            align-top
          `
      }
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
          case "date":
            return (
              <TableCell key={key} className="text-xs">
                {formatDate(task.issueDate)}
              </TableCell>
            );
          case "partner":
            return (
              <TableCell key={key} className="truncate text-xs">
                {task.partner ?? "—"}
              </TableCell>
            );
          case "product":
            return (
              <TableCell key={key} className="truncate text-xs">
                {task.product ?? "—"}
              </TableCell>
            );
          case "issueType":
            return (
              <TableCell key={key} className="truncate text-xs">
                {task.issueType ?? "—"}
              </TableCell>
            );
          case "observation":
            return (
              <TableCell key={key} className="align-top">
                <p className="text-xs font-medium">{task.title}</p>
                {task.observation ? (
                  <ExpandableText text={task.observation} max={200} />
                ) : null}
              </TableCell>
            );
          case "expectation":
            return (
              <TableCell key={key} className="align-top">
                {task.expectation ? (
                  <ExpandableText text={task.expectation} max={200} />
                ) : (
                  <span className="text-muted-foreground text-[11px]">—</span>
                )}
              </TableCell>
            );
          case "priority":
            return (
              <TableCell key={key}>
                <Badge variant={PRIORITY_VARIANTS[task.priority]}>
                  {task.priority}
                </Badge>
              </TableCell>
            );
          case "status":
            return (
              <TableCell key={key}>
                <Badge variant={STATUS_VARIANTS[task.status]}>
                  {STATUS_LABELS[task.status]}
                </Badge>
              </TableCell>
            );
          case "eta":
            return (
              <TableCell key={key} className="text-xs">
                {task.eta ?? "—"}
              </TableCell>
            );
          case "comment":
            return (
              <TableCell key={key} className="align-top">
                {task.qaComment ? (
                  <ExpandableText text={task.qaComment} max={200} />
                ) : (
                  <span className="text-muted-foreground text-[11px]">—</span>
                )}
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
