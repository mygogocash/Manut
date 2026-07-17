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
import {
  deleteUpdate,
  type InvestorUpdate,
} from "@/services/investor-update.service";

interface DeleteUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorUpdate: InvestorUpdate | null;
  onDeleted: () => void;
}

export function DeleteUpdateDialog({
  open,
  onOpenChange,
  investorUpdate,
  onDeleted,
}: DeleteUpdateDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!investorUpdate) return;
    e.preventDefault();
    try {
      setSubmitting(true);
      await deleteUpdate(investorUpdate.id);
      toast.success(`Deleted "${investorUpdate.title}"`);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete update";
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
          <AlertDialogTitle>Delete update</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently remove{" "}
            <span className="text-foreground font-medium">
              {investorUpdate?.title ?? "this update"}
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
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
