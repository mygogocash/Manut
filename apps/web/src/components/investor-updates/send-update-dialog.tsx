"use client";

import { Loader2, Send } from "lucide-react";
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
  type InvestorUpdate,
  sendUpdate,
} from "@/services/investor-update.service";

interface SendUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorUpdate: InvestorUpdate | null;
  onSent: () => void;
}

export function SendUpdateDialog({
  open,
  onOpenChange,
  investorUpdate,
  onSent,
}: SendUpdateDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    if (!investorUpdate) return;
    e.preventDefault();
    try {
      setSubmitting(true);
      await sendUpdate(investorUpdate.id);
      toast.success("Update sent to investors");
      onSent();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to send update";
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
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <Send />
          </AlertDialogMedia>
          <AlertDialogTitle>Send investor update</AlertDialogTitle>
          <AlertDialogDescription>
            Send{" "}
            <span className="text-foreground font-medium">
              {investorUpdate?.title ?? "this update"}
            </span>{" "}
            to all investors? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Send update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
