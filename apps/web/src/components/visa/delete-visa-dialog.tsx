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
import { deleteVisa, type VisaRecord } from "@/services/visa.service";

interface DeleteVisaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visa: VisaRecord | null;
  onDeleted: (visa: VisaRecord) => void;
}

export function DeleteVisaDialog({
  open,
  onOpenChange,
  visa,
  onDeleted,
}: DeleteVisaDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!visa) return;
    e.preventDefault();
    try {
      setSubmitting(true);
      await deleteVisa(visa.id);
      toast.success("Visa record deleted");
      onDeleted(visa);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete visa record";
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
          <AlertDialogTitle>Delete visa record</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently remove the{" "}
            <span className="text-foreground font-medium">
              {visa?.visaType ?? "visa"} — {visa?.country ?? ""}
            </span>{" "}
            record for{" "}
            <span className="text-foreground font-medium">
              {visa?.employee?.name ?? "this employee"}
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
            Delete record
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
