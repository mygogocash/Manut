"use client";

import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { OfficeFormDialog } from "@/components/office/office-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import {
  deleteOffice,
  listOffices,
  type Office,
} from "@/services/office.service";

interface ManageOfficesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function ManageOfficesDialog({
  open,
  onOpenChange,
  onChanged,
}: ManageOfficesDialogProps) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Office | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Office | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOffices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listOffices();
      setOffices(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load offices";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchOffices();
  }, [open, fetchOffices]);

  function handleSaved() {
    fetchOffices();
    onChanged?.();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteOffice(deleteTarget.id);
      toast.success("Office deleted");
      setDeleteTarget(null);
      handleSaved();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete office";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`
            max-h-[90vh] overflow-y-auto
            sm:max-w-2xl
          `}
        >
          <DialogHeader>
            <DialogTitle>Manage offices</DialogTitle>
            <DialogDescription>
              Add or edit office locations. Desks and rooms attach to an office.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-3 flex items-center justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" />
              New office
            </Button>
          </div>

          <div className="border-border overflow-hidden rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            ) : offices.length === 0 ? (
              <div className="text-muted-foreground py-10 text-center text-sm">
                No offices yet. Create one to start adding desks and rooms.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-muted-foreground text-left text-[12px]">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">City</th>
                    <th className="px-3 py-2 font-medium">Country</th>
                    <th className="px-3 py-2 font-medium">Capacity</th>
                    <th className="w-20 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {offices.map((o) => (
                    <tr
                      key={o.id}
                      className={`
                        border-border border-t
                        last:border-b-0
                      `}
                    >
                      <td className="text-foreground px-3 py-2 font-medium">
                        {o.name}
                      </td>
                      <td className="px-3 py-2">{o.city ?? "—"}</td>
                      <td className="px-3 py-2">{o.country ?? "—"}</td>
                      <td className="px-3 py-2">{o.capacity ?? 0}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(o);
                              setFormOpen(true);
                            }}
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(o)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OfficeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        office={editing}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!deleting && !next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete office</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;
              <span className="text-foreground font-medium">
                {deleteTarget?.name}
              </span>
              &rdquo;? Desks, rooms, and assets attached to this office must be
              moved or removed first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
