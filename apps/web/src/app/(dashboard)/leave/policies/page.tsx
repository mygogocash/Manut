"use client";

import {
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LeaveBalanceImportDialog } from "@/components/leave/leave-balance-import-dialog";
import { LeavePolicyDialog } from "@/components/leave/leave-policy-dialog";
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
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  deleteLeaveType,
  getAllLeaveTypes,
  type LeaveType,
  updateLeaveType,
} from "@/services/leave.service";

const CATEGORY_LABEL: Record<string, string> = {
  sick: "Sick",
  casual: "Casual",
  earned: "Earned",
  paid: "Paid",
  unpaid: "Unpaid",
  other: "Other",
};

export default function LeavePoliciesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("leave:hr-settings");
  const canImport = hasPermission("leave:bulk-import");

  const [policies, setPolicies] = useState<LeaveType[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityFilter, setEntityFilter] = useState<string>("__all__");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LeaveType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const filter = entityFilter === "__all__" ? undefined : entityFilter;
      const res = await getAllLeaveTypes(
        filter as string | "global" | undefined,
      );
      setPolicies(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load leave policies";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [entityFilter]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  useEffect(() => {
    if (!canManage) return;
    void listEntities()
      .then((res) => setEntities(res.data))
      .catch(() => {});
  }, [canManage]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await deleteLeaveType(pendingDelete.id);
      toast.success(`Policy "${pendingDelete.name}" deleted`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete policy";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  async function deactivateInstead() {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await updateLeaveType(pendingDelete.id, { isActive: false });
      toast.success(`Policy "${pendingDelete.name}" deactivated`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to deactivate policy";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  if (!canManage) {
    return (
      <div className="px-6 py-10">
        <PageHeader
          title="Leave Policies"
          subtitle="You do not have permission to manage leave policies."
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Leave Policies"
        subtitle="Define leave types, descriptions, and the days granted per year."
      >
        <Button variant="outline" asChild>
          <Link href="/leave/holidays">
            <CalendarDays className="mr-2 h-4 w-4" />
            Holidays
          </Link>
        </Button>
        {canImport && (
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import roster
          </Button>
        )}
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New policy
        </Button>
      </PageHeader>

      <div
        className={`
          border-border bg-surface mb-3 flex items-center gap-2 rounded-lg
          border p-3
        `}
      >
        <span className="text-muted-foreground text-xs">Entity</span>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-9 w-[220px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All entities</SelectItem>
            <SelectItem value="global">Global (no entity)</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} ({e.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Days/year</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <Loader2
                    className={`
                      text-muted-foreground mx-auto h-5 w-5 animate-spin
                    `}
                  />
                </TableCell>
              </TableRow>
            ) : policies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-muted-foreground py-12 text-center text-sm"
                >
                  No policies yet. Create your first one.
                </TableCell>
              </TableRow>
            ) : (
              policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.description && (
                      <div
                        className={`
                          text-muted-foreground mt-0.5 line-clamp-2 max-w-md
                          text-xs
                        `}
                      >
                        {p.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.entity ? (
                      <span className="text-xs">
                        {p.entity.name}{" "}
                        <span className="text-muted-foreground">
                          ({p.entity.code})
                        </span>
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Global
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {p.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    {CATEGORY_LABEL[p.category] ?? p.category}
                  </TableCell>
                  <TableCell className="text-right">{p.daysPerYear}</TableCell>
                  <TableCell>
                    {p.isPaid ? (
                      <Badge variant="secondary">Paid</Badge>
                    ) : (
                      <Badge variant="outline">Unpaid</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.requiresApproval ? "Required" : "Auto"}
                  </TableCell>
                  <TableCell>
                    {p.isActive ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(p);
                          setDialogOpen(true);
                        }}
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setPendingDelete(p)}
                        aria-label={`Delete ${p.name}`}
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

      <LeavePolicyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        policy={editing}
        onSaved={load}
      />

      <LeaveBalanceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onCompleted={load}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete leave policy?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  &ldquo;{pendingDelete.name}&rdquo; will be permanently
                  removed. If any employee balance, request, or transaction
                  references it, the delete is blocked — deactivate it instead
                  so historical data stays intact.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={`
              flex-col gap-2
              sm:flex-row
            `}
          >
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            {pendingDelete?.isActive && (
              <Button
                type="button"
                variant="outline"
                onClick={deactivateInstead}
                disabled={deleting}
              >
                Deactivate instead
              </Button>
            )}
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className={`
                bg-destructive
                hover:bg-destructive/90
              `}
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
