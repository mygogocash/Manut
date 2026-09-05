"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { BadgeVariant } from "@/components/shared/badge";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { PermissionButton } from "@/components/shared/permission-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { useFundraisingEntity } from "@/providers/fundraising-entity-provider";
import { listInvestors } from "@/services/investor.service";
import {
  completeInvestorTask,
  createInvestorTask,
  deleteInvestorTask,
  INVESTOR_TASK_STATUS_LABELS,
  type InvestorTask,
  listInvestorTasks,
  updateInvestorTask,
} from "@/services/investor-task.service";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  open: "blue",
  done: "green",
  cancelled: "grey",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface InvestorOption {
  id: string;
  name: string;
}

export function InvestorTasksTab() {
  const { hasPermission } = useAuth();
  const { entityKey } = useFundraisingEntity();
  const canCreate = hasPermission("investors:create");
  const canUpdate = hasPermission("investors:update");
  const canDelete = hasPermission("investors:delete");

  const [tasks, setTasks] = useState<InvestorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [investorOptions, setInvestorOptions] = useState<InvestorOption[]>([]);

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    setTotalCount,
    totalPages,
    totalCount,
  } = usePagination();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestorTask | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listInvestorTasks({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        fundraisingEntity: entityKey,
      });
      setTasks(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load tasks";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, entityKey, setTotalCount]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    setPage(1);
  }, [entityKey, setPage]);

  useEffect(() => {
    listInvestors({ limit: 200, fundraisingEntity: entityKey })
      .then((r) =>
        setInvestorOptions(r.data.map((i) => ({ id: i.id, name: i.name }))),
      )
      .catch(() => undefined);
  }, [entityKey]);

  async function toggleComplete(t: InvestorTask) {
    if (!canUpdate || t.status === "cancelled") return;
    const previous = tasks;
    const nextStatus = t.status === "done" ? "open" : "done";
    setTasks((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, status: nextStatus } : x)),
    );
    try {
      if (nextStatus === "done") {
        await completeInvestorTask(t.id);
      } else {
        await updateInvestorTask(t.id, { status: "open" });
      }
    } catch (err) {
      setTasks(previous);
      const msg =
        err instanceof ApiError ? err.message : "Failed to update task";
      toast.error(msg);
    }
  }

  async function remove(t: InvestorTask) {
    if (!canDelete) return;
    if (!window.confirm(`Delete task "${t.subject}"?`)) return;
    const previous = tasks;
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    try {
      await deleteInvestorTask(t.id);
      toast.success("Task deleted");
    } catch (err) {
      setTasks(previous);
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete task";
      toast.error(msg);
    }
  }

  const skeleton = Array.from({ length: Math.min(pageSize, 6) });
  const statusFilterValue = statusFilter || "all";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={statusFilterValue}
          onValueChange={(value) => {
            setStatusFilter(value === "all" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-[150px] text-xs"
            aria-label="Filter by status"
          >
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <PermissionButton
          permission="investors:create"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New task
        </PermissionButton>
      </div>

      <Table containerClassName="max-h-[60svh] md:max-h-[calc(100vh-340px)] overflow-auto rounded-lg border">
        <TableHeader className="bg-background sticky top-0 z-10">
          <TableRow>
            <TableHead className="w-[40px]" />
            <TableHead>Subject</TableHead>
            <TableHead>Investor</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            skeleton.map((_, i) => (
              <TableRow key={`s-${i}`}>
                <TableCell colSpan={7}>
                  <div className="bg-muted h-5 w-full animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : tasks.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground py-10 text-center text-xs"
              >
                No tasks yet
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void toggleComplete(t)}
                    disabled={!canUpdate || t.status === "cancelled"}
                    aria-label={
                      t.status === "done" ? "Reopen task" : "Complete task"
                    }
                    className="text-muted-foreground size-7"
                  >
                    {t.status === "done" ? (
                      <CheckCircle2 className="text-success size-4" />
                    ) : (
                      <Circle className="size-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell
                  className={`
                    text-sm font-medium
                    ${
                      t.status === "done"
                        ? "text-muted-foreground line-through"
                        : ""
                    }
                  `}
                >
                  {t.subject}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {t.investor?.name ?? "—"}
                </TableCell>
                <TableCell
                  className={`text-muted-foreground text-xs tabular-nums`}
                >
                  {fmtDate(t.dueDate)}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[t.status] ?? "grey"}>
                    {INVESTOR_TASK_STATUS_LABELS[t.status] ?? t.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {t.owner?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canUpdate && t.status !== "cancelled" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(t);
                          setFormOpen(true);
                        }}
                        aria-label="Edit task"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void remove(t)}
                        aria-label="Delete task"
                      >
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <DataPagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        investorOptions={investorOptions}
        canSubmit={editing ? canUpdate : canCreate}
        onSaved={() => {
          setFormOpen(false);
          void fetchTasks();
        }}
      />
    </div>
  );
}

function TaskFormDialog({
  open,
  onOpenChange,
  task,
  investorOptions,
  canSubmit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: InvestorTask | null;
  investorOptions: InvestorOption[];
  canSubmit: boolean;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(task?.subject ?? "");
    setDueDate(task ? String(task.dueDate).slice(0, 10) : "");
    setInvestorId(task?.investorId ?? "");
  }, [open, task]);

  async function submit() {
    if (!subject.trim() || !dueDate) {
      toast.error("Subject and due date are required");
      return;
    }
    if (!task && !investorId) {
      toast.error("Pick an investor");
      return;
    }
    try {
      setSaving(true);
      if (task) {
        await updateInvestorTask(task.id, {
          subject: subject.trim(),
          dueDate,
        });
        toast.success("Task updated");
      } else {
        await createInvestorTask({
          subject: subject.trim(),
          dueDate,
          investorId,
        });
        toast.success("Task created");
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to save task";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {!task ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-investor">Investor</Label>
              <Select
                value={investorId || "__none__"}
                onValueChange={(value) =>
                  setInvestorId(value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger id="task-investor" className="w-full">
                  <SelectValue placeholder="Select investor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select investor...</SelectItem>
                  {investorOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-subject">Subject</Label>
            <Input
              id="task-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Follow up on term sheet…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <FormDatePicker
              value={dueDate}
              onChange={(val) => setDueDate(val)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !canSubmit}>
            {saving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : null}
            {task ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
