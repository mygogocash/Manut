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

import { PayrollApprovalStepDialog } from "@/components/payroll/payroll-approval-step-dialog";
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
  deletePayrollApprovalStep,
  listPayrollApprovalSteps,
  type PayrollApprovalStep,
  reorderPayrollApprovalSteps,
} from "@/services/payroll-approval.service";
import { listUsers, type UserListItem } from "@/services/user.service";

export default function PayrollApprovalConfigPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("payroll:hr-admin");

  const [steps, setSteps] = useState<PayrollApprovalStep[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollApprovalStep | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<PayrollApprovalStep | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [stepsRes, usersRes] = await Promise.all([
        listPayrollApprovalSteps(),
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

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= steps.length) return;
    const reordered = [...steps];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(next, 0, item!);
    setSteps(reordered);
    try {
      setReordering(true);
      const res = await reorderPayrollApprovalSteps(reordered.map((s) => s.id));
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
      await deletePayrollApprovalStep(pendingDelete.id);
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
          title="Payroll Approval"
          subtitle="You do not have permission to configure payroll approvals."
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Payroll Approval Chain"
        subtitle="Define the ordered approvers every payroll run must pass through before it can be marked approved."
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
            No approval steps configured. Until at least one step is added,
            payroll runs can be approved directly by anyone with{" "}
            <span className="font-mono">payroll:approve</span>.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <Loader2
                      className={`
                        text-muted-foreground mx-auto h-5 w-5 animate-spin
                      `}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                steps.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">
                      {s.order}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      {s.description && (
                        <div
                          className={`
                            text-muted-foreground mt-0.5 max-w-md text-xs
                          `}
                        >
                          {s.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.approverUser ? (
                        <span>
                          {s.approverUser.name}
                          <span className="text-muted-foreground ml-2 text-xs">
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
                          aria-label="Edit step"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setPendingDelete(s)}
                          aria-label="Delete step"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <PayrollApprovalStepDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        step={editing}
        users={users}
        onSaved={() => {
          setDialogOpen(false);
          void load();
        }}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete approval step</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the &ldquo;{pendingDelete?.name}&rdquo; step? The remaining
              steps will renumber automatically. This cannot be undone.
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
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
