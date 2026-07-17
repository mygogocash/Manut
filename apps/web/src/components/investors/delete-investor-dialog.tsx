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
import { deleteInvestor, type Investor } from "@/services/investor.service";

interface DeleteInvestorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor: Investor | null;
  onDeleted: (investor: Investor) => void;
}

export function DeleteInvestorDialog({
  open,
  onOpenChange,
  investor,
  onDeleted,
}: DeleteInvestorDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!investor) return;
    e.preventDefault();
    try {
      setSubmitting(true);
      await deleteInvestor(investor.id);
      toast.success(`Deleted ${investor.name}`);
      onDeleted(investor);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete investor";
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
          <AlertDialogTitle>Delete investor</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently remove{" "}
            <span className="text-foreground font-medium">
              {investor?.name ?? "this investor"}
            </span>
            ? All associated investments will also be removed. This action
            cannot be undone.
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
            Delete investor
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
