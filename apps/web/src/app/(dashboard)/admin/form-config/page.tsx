"use client";

import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import {
  type AdminDepartment,
  createAdminDepartment,
  deactivateAdminDepartment,
  listAdminDepartments,
  updateAdminDepartment,
} from "@/services/admin.service";

export default function FormConfigPage() {
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDepartment | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deactivateTarget, setDeactivateTarget] =
    useState<AdminDepartment | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAdminDepartments();
      setDepartments(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load departments";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDepartments();
  }, [fetchDepartments]);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setDescription("");
    setFormOpen(true);
  }

  function openEdit(dept: AdminDepartment) {
    setEditing(dept);
    setName(dept.name);
    setCode(dept.code ?? "");
    setDescription(dept.description ?? "");
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateAdminDepartment(editing.id, {
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || undefined,
        });
        toast.success("Department updated");
      } else {
        await createAdminDepartment({
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || undefined,
        });
        toast.success("Department added");
      }
      setFormOpen(false);
      void fetchDepartments();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save department";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReactivate(dept: AdminDepartment) {
    try {
      await updateAdminDepartment(dept.id, { isActive: true });
      toast.success("Department reactivated");
      void fetchDepartments();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to reactivate";
      toast.error(msg);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    try {
      await deactivateAdminDepartment(deactivateTarget.id);
      toast.success("Department deactivated");
      setDeactivateTarget(null);
      void fetchDepartments();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to deactivate";
      toast.error(msg);
    }
  }

  const activeRows = departments.filter((d) => d.isActive);
  const inactiveRows = departments.filter((d) => !d.isActive);

  return (
    <div>
      <PageHeader
        title="Form configuration"
        subtitle="Manage dropdown options used across the intranet forms"
      >
        <PermissionButton permission="admin:manage" onClick={openCreate}>
          <Plus className="size-3.5" />
          Add department
        </PermissionButton>
      </PageHeader>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Departments</CardTitle>
            <p className="text-muted-foreground text-xs">
              These names drive the Department dropdown on the Employee,
              Project, and Partner forms. Renaming a department here updates the
              label everywhere; deactivating hides it from the dropdown without
              affecting existing records.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full rounded-md" />
            ) : (
              <>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3 font-medium">Name</th>
                      <th className="py-2 pr-3 font-medium">Code</th>
                      <th className="py-2 pr-3 font-medium">Description</th>
                      <th className="w-32 py-2 pr-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((d) => (
                      <tr key={d.id} className="border-border/40 border-t">
                        <td className="py-2 pr-3 font-medium">{d.name}</td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {d.code ?? "—"}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {d.description ?? "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEdit(d)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => setDeactivateTarget(d)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-muted-foreground py-6 text-center"
                        >
                          No departments yet. Add one to populate the dropdown.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>

                {inactiveRows.length > 0 ? (
                  <div className="mt-6">
                    <h3
                      className={`
                        text-muted-foreground mb-2 text-[10px] font-semibold
                        tracking-[0.08em] uppercase
                      `}
                    >
                      Inactive
                    </h3>
                    <table className="w-full text-xs">
                      <tbody>
                        {inactiveRows.map((d) => (
                          <tr
                            key={d.id}
                            className="border-border/40 border-t opacity-60"
                          >
                            <td className="py-2 pr-3">{d.name}</td>
                            <td className="text-muted-foreground py-2 pr-3">
                              {d.code ?? "—"}
                            </td>
                            <td className="text-muted-foreground py-2 pr-3">
                              {d.description ?? "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleReactivate(d)}
                              >
                                <RotateCcw className="mr-1 size-3.5" />
                                Reactivate
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other dropdowns</CardTitle>
            <p className="text-muted-foreground text-xs">
              Employment types, entity list, and other form options still ship
              as code-level whitelists. Reach out to the platform team when you
              need a change here — UI-driven editing will land in a follow-up.
            </p>
          </CardHeader>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit department" : "Add department"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `Rename or update ${editing.name}.`
                : "Add a new department to the dropdown options."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div>
              <Label className="block text-xs font-medium">Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Business Team"
                autoFocus
              />
            </div>
            <div>
              <Label className="block text-xs font-medium">Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BIZ"
                maxLength={20}
              />
            </div>
            <div>
              <Label className="block text-xs font-medium">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about this department"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : null}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate department?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `"${deactivateTarget.name}" will be hidden from the dropdown. Existing employees / projects tagged with this department keep the label; deactivation only prevents new assignments. You can reactivate it later from the Inactive section.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeactivate();
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
