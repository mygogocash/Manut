"use client";

import { Loader2 } from "lucide-react";

import { Modal, ModalActions } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  benefitName: string;
  loading: boolean;
}

export function BenefitDeleteDialog({
  open,
  onClose,
  onConfirm,
  benefitName,
  loading,
}: DeleteDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Benefit"
      subtitle={`Are you sure you want to delete "${benefitName}"? This action cannot be undone.`}
    >
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={loading}>
          {loading && <Loader2 className="mr-1.5 size-3 animate-spin" />}
          Delete
        </Button>
      </ModalActions>
    </Modal>
  );
}
