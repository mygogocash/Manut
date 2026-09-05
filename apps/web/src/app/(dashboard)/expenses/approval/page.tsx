"use client";

import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ExpenseApprovalStepDialog } from "@/components/expenses/expense-approval-step-dialog";
import { ExpenseNotificationRecipientsCard } from "@/components/expenses/expense-notification-recipients-card";
import { PageHeader } from "@/components/shared/page-header";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteExpenseApprovalStep,
  EXPENSE_STAGE_ROLE_LABEL,
  type ExpenseApprovalStep,
  type ExpenseRecipient,
  getExpenseNotificationRecipients,
  listExpenseApprovalSteps,
  reorderExpenseApprovalSteps,
  setExpenseNotificationRecipients,
  updateExpenseApprovalStep,
} from "@/services/expense.service";
import { listUsers, type UserListItem } from "@/services/user.service";

export default function ExpenseApprovalConfigPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("expense:assign-approver");
  const canEditSettings = hasPermission("expense:hr-settings");

  const [steps, setSteps] = useState<ExpenseApprovalStep[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseApprovalStep | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<ExpenseApprovalStep | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [stepsRes, usersRes] = await Promise.all([
        listExpenseApprovalSteps(),
        listUsers({ limit: 200 }),
      ]);
      setSteps(stepsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load approval chain";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const fetchExpenseRecipients = useCallback(async () => {
    const res = await getExpenseNotificationRecipients();
    return res.data;
  }, []);

  const saveExpenseRecipients = useCallback(
    async (recipients: ExpenseRecipient[]) => {
      const res = await setExpenseNotificationRecipients(recipients);
      return res.data;
    },
    [],
  );

  async function saveOrder(stepId: string, nextOrder: number) {
    const target = steps.find((s) => s.id === stepId);
    if (!target || target.order === nextOrder) return;
    try {
      setReordering(true);
      await updateExpenseApprovalStep(stepId, { order: nextOrder });
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save order";
      toast.error(message);
    } finally {
      setReordering(false);
    }
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= steps.length) return;
    const reordered = [...steps];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(next, 0, item!);
    setSteps(reordered);
    try {
      setReordering(true);
      const res = await reorderExpenseApprovalSteps(reordered.map((s) => s.id));
      setSteps(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to reorder";
      toast.error(message);
      void load();
    } finally {
      setReordering(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await deleteExpenseApprovalStep(pendingDelete.id);
      toast.success(`Step "${pendingDelete.name}" deleted`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete step";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  if (!canManage) {
    return (
      <div className="px-6 py-10">
        <PageHeader
          title="Expense Approval"
          subtitle="You do not have permission to configure expense approvals."
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Expense Approval Chain"
        subtitle="Define the ordered stages every expense report must pass through."
      >
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add step
        </Button>
      </PageHeader>

      {steps.length === 0 && !loading ? (
        <div className="bg-card rounded-md border p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No approval steps configured. New requests fall back to the
            submitter&apos;s direct manager.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-md border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Order</TableHead>
                <TableHead className="w-[30%]">Name</TableHead>
                <TableHead className="w-[110px]">Stage</TableHead>
                <TableHead className="w-[26%]">Approver</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <Loader2
                      className={`
                        text-muted-foreground mx-auto h-5 w-5 animate-spin
                      `}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                steps.map((s, idx) => (
                  <TableRow key={s.id} className="align-top">
                    <TableCell className="font-mono text-sm">
                      <OrderInput
                        value={s.order}
                        disabled={!canManage || reordering}
                        onCommit={(next) => saveOrder(s.id, next)}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-medium break-words">{s.name}</div>
                      {s.description && (
                        <div
                          className={`
                            text-muted-foreground mt-0.5 text-xs break-words
                            whitespace-normal
                          `}
                        >
                          {s.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {s.stageRole === "review" ? (
                        <Badge
                          variant="outline"
                          className={`
                            border-amber-500 text-amber-700
                            dark:text-amber-400
                          `}
                        >
                          {EXPENSE_STAGE_ROLE_LABEL.review}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`
                            border-emerald-500 text-emerald-700
                            dark:text-emerald-400
                          `}
                        >
                          {EXPENSE_STAGE_ROLE_LABEL.approve}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-sm break-words">
                      {s.approverType === "manager" ? (
                        <span>Submitter&apos;s manager</span>
                      ) : s.approverUser ? (
                        <span>
                          {s.approverUser.name}
                          <span
                            className={`
                              text-muted-foreground ml-2 block text-xs
                              break-words
                              sm:inline
                            `}
                          >
                            {s.approverUser.email}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          User removed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={idx === 0 || reordering}
                          onClick={() => move(idx, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={idx === steps.length - 1 || reordering}
                          onClick={() => move(idx, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(s);
                            setDialogOpen(true);
                          }}
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPendingDelete(s)}
                          aria-label={`Delete ${s.name}`}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {canEditSettings && (
        <ExpenseNotificationRecipientsCard
          title="Finance-desk notifications"
          description="Addresses that receive a long-form summary email when an expense report is fully approved. Choose `Every event` per recipient to also email at submit time — useful for finance staff who plan the next payroll batch before the approval chain finishes."
          placeholder="finance-desk@thebinaryholdings.com"
          fetcher={fetchExpenseRecipients}
          persister={saveExpenseRecipients}
        />
      )}

      <ExpenseApprovalStepDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        step={editing}
        users={users}
        onSaved={load}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete approval step?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `"${pendingDelete.name}" will be removed from the chain. In-flight requests already routed through this stage are unaffected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Inline order editor. Stays a string while the user types so we
// don't auto-save on each keystroke; commits on blur or Enter and
// reverts on Escape. Empty / non-numeric input resets to the
// original value so a stray edit can't accidentally delete the
// ordering.
function OrderInput({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled?: boolean;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      return;
    }
    if (parsed === value) return;
    onCommit(parsed);
  }

  return (
    <Input
      type="number"
      min={0}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 w-[72px] font-mono text-sm"
      aria-label="Step order"
    />
  );
}
