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
  deleteNinetyDayNotification,
  type NinetyDayNotification,
} from "@/services/ninety-day.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NinetyDayNotification | null;
  onDeleted: (record: NinetyDayNotification) => void;
}

export function DeleteNinetyDayDialog({
  open,
  onOpenChange,
  record,
  onDeleted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!record) return;
    e.preventDefault();
    try {
      setSubmitting(true);
      await deleteNinetyDayNotification(record.id);
      toast.success("90-day notification deleted");
      onDeleted(record);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete notification";
      toast.error(msg);
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
          <AlertDialogTitle>Delete 90-day notification</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently remove the 90-day notification for{" "}
            <span className="text-foreground font-medium">
              {record?.employee?.name ?? "this applicant"}
            </span>
            ? This cannot be undone.
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
