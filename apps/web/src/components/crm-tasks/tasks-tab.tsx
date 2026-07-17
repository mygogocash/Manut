"use client";

import { format } from "date-fns";
import { Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { TaskFormDialog } from "@/components/crm-tasks/task-form-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PermissionButton } from "@/components/shared/permission-button";
import { PermissionDropdownMenuItem } from "@/components/shared/permission-dropdown-menu-item";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import {
  completeCrmTask,
  type CrmTask,
  deleteCrmTask,
  listCrmTasks,
  TASK_BUCKET_LABELS,
  TASK_BUCKETS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskBucket,
  type TaskStatus,
} from "@/services/crm-task.service";

const ALL = "__all__";

export function TasksTab() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [bucketFilter, setBucketFilter] = useState("");
  const pagination = usePagination();
  const { page, pageSize, setTotalCount } = pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmTask | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<CrmTask | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listCrmTasks({
        page,
        limit: pageSize,
        status: (statusFilter || undefined) as TaskStatus | undefined,
        bucket: (bucketFilter || undefined) as TaskBucket | undefined,
      });
      setTasks(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load tasks";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, bucketFilter, setTotalCount]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(t: CrmTask) {
    if (t.status === "cancelled") {
      toast.error("Cannot edit a cancelled task. Recreate it instead.");
      return;
    }
    setEditing(t);
    setFormOpen(true);
  }

  function openDelete(t: CrmTask) {
    setDeleting(t);
    setDeleteOpen(true);
  }

  async function handleComplete(t: CrmTask) {
    if (t.status === "cancelled") return;
    try {
      setCompleting(t.id);
      // Toggle: completing a done task isn't supported (server returns row
      // unchanged); reopening done → open uses the update endpoint instead.
      await completeCrmTask(t.id);
      toast.success("Task completed");
      fetchTasks();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to complete task";
      toast.error(message);
    } finally {
      setCompleting(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      setDeleteSubmitting(true);
      await deleteCrmTask(deleting.id);
      toast.success("Task deleted");
      setDeleteOpen(false);
      setDeleting(null);
      fetchTasks();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete task";
      toast.error(message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns = [
    {
      key: "complete",
      header: "",
      className: "w-8",
      render: (t: CrmTask) => (
        <Checkbox
          checked={t.status === "done"}
          disabled={t.status !== "open" || completing === t.id}
          onCheckedChange={(v) => {
            if (v && t.status === "open") handleComplete(t);
          }}
          aria-label={`Mark ${t.subject} done`}
        />
      ),
    },
    {
      key: "subject",
      header: "Subject",
      render: (t: CrmTask) => (
        <span
          className={
            t.status === "done"
              ? `text-muted-foreground line-through`
              : "text-foreground font-medium"
          }
        >
          {t.subject}
        </span>
      ),
    },
    {
      key: "anchor",
      header: "Tied to",
      render: (t: CrmTask) => {
        if (t.opportunity) return t.opportunity.name;
        if (t.lead) return t.lead.company;
        return "—";
      },
    },
    {
      key: "dueDate",
      header: "Due",
      render: (t: CrmTask) =>
        t.dueDate
          ? format(
              new Date(String(t.dueDate).slice(0, 10) + "T00:00:00"),
              "MMM d, yyyy",
            )
          : "—",
    },
    {
      key: "status",
      header: "Status",
      render: (t: CrmTask) => (
        <Badge status={t.status}>
          {TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status}
        </Badge>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      render: (t: CrmTask) => t.owner?.name ?? "—",
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (t: CrmTask) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PermissionDropdownMenuItem
              permissions={["crm:update"]}
              onClick={() => openEdit(t)}
              disabled={t.status === "cancelled"}
            >
              <Edit className="mr-2 size-3.5" />
              Edit
            </PermissionDropdownMenuItem>
            <DropdownMenuSeparator />
            <PermissionDropdownMenuItem
              permissions={["crm:delete"]}
              className="text-destructive"
              onClick={() => openDelete(t)}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </PermissionDropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={bucketFilter || ALL}
            onValueChange={(v) => {
              setBucketFilter(v === ALL ? "" : v);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All due dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All due dates</SelectItem>
              {TASK_BUCKETS.map((b) => (
                <SelectItem key={b} value={b}>
                  {TASK_BUCKET_LABELS[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter || ALL}
            onValueChange={(v) => {
              setStatusFilter(v === ALL ? "" : v);
              pagination.setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PermissionButton permission="crm:create" onClick={openCreate}>
          <Plus className="mr-1.5 size-3.5" />
          New task
        </PermissionButton>
      </div>

      <DataTable
        columns={columns}
        data={tasks}
        loading={loading}
        emptyMessage="No tasks. Add a follow-up tied to a lead or opportunity."
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

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        onSaved={fetchTasks}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${deleting.subject} will be permanently removed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
