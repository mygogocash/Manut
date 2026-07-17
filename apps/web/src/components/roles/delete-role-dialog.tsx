"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { ApiError } from "@/lib/api-client";
import { deleteRole, type RoleListItem } from "@/services/role.service";

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleListItem | null;
  onDeleted: () => void;
}

export function DeleteRoleDialog({
  open,
  onOpenChange,
  role,
  onDeleted,
}: DeleteRoleDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!role) return;
    e.preventDefault();
    try {
      setSubmitting(true);
      await deleteRole(role.id);
      toast.success(`Role "${role.name}" deleted`);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete role";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete role</AlertDialogTitle>
          <AlertDialogDescription>
            Delete role &ldquo;
            <span className="text-foreground font-medium">
              {role?.name ?? "this role"}
            </span>
            &rdquo;? Users with this role will lose it. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Delete role
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
