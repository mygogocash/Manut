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
import { deleteEsopGrant, type EsopGrant } from "@/services/hrms.service";

interface DeleteGrantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grant: EsopGrant | null;
  onDeleted: () => void;
}

export function DeleteGrantDialog({
  open,
  onOpenChange,
  grant,
  onDeleted,
}: DeleteGrantDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!grant) return;
    e.preventDefault();
    try {
      setSubmitting(true);
      await deleteEsopGrant(grant.id);
      toast.success("ESOP grant deleted");
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete grant";
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
          <AlertDialogTitle>Delete ESOP grant</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently remove the grant of{" "}
            <span className="text-foreground font-medium">
              {grant?.shares.toLocaleString() ?? 0} shares
            </span>{" "}
            for{" "}
            <span className="text-foreground font-medium">
              {grant?.employee.name ?? "this employee"}
            </span>
            ? This action cannot be undone.
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
            Delete grant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
