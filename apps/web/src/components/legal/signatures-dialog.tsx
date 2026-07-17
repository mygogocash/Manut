"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import {
  cancelSignature,
  LEGAL_SIGNATURE_STATUS_LABELS,
  type LegalSignature,
  listDocumentSignatures,
} from "@/services/legal.service";

const STATUS_VARIANT: Record<
  LegalSignature["status"],
  "green" | "red" | "grey" | "blue" | "amber"
> = {
  pending: "grey",
  sent: "blue",
  viewed: "amber",
  signed: "green",
  declined: "red",
  cancelled: "grey",
};

interface SignaturesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentTitle?: string;
  canCancel: boolean;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

export function SignaturesDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  canCancel,
}: SignaturesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [signatures, setSignatures] = useState<LegalSignature[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    setLoading(true);
    listDocumentSignatures(documentId)
      .then((res) => {
        if (!cancelled) setSignatures(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Failed to load signatures";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  async function handleCancel(sig: LegalSignature) {
    if (!confirm(`Cancel signing request for ${sig.signerEmail}?`)) return;
    try {
      setCancellingId(sig.id);
      await cancelSignature(sig.id);
      setSignatures((prev) =>
        prev.map((s) =>
          s.id === sig.id ? { ...s, status: "cancelled" as const } : s,
        ),
      );
      toast.success("Signature request cancelled");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to cancel";
      toast.error(message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-h-[85vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Signatures</DialogTitle>
          <DialogDescription>
            {documentTitle
              ? `Signing requests for "${documentTitle}"`
              : "Signing requests for this document"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div
            className={`
              text-muted-foreground flex items-center justify-center gap-2 py-12
              text-xs
            `}
          >
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </div>
        ) : signatures.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            No signature requests yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {signatures.map((sig) => {
              const canCancelThis =
                canCancel &&
                sig.status !== "signed" &&
                sig.status !== "declined" &&
                sig.status !== "cancelled";
              return (
                <li
                  key={sig.id}
                  className={`
                    border-border bg-surface flex flex-col gap-1 rounded-md
                    border p-3 text-xs
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 leading-tight">
                      <p className="text-foreground text-xs font-medium">
                        {sig.signerName}
                        <span
                          className={`
                            text-muted-foreground ml-1.5 text-[10px] font-normal
                          `}
                        >
                          · order {sig.signingOrder}
                        </span>
                      </p>
                      <p className="text-muted-foreground truncate text-[11px]">
                        {sig.signerEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[sig.status] ?? "grey"}>
                        {LEGAL_SIGNATURE_STATUS_LABELS[sig.status]}
                      </Badge>
                      {canCancelThis ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Cancel signature"
                          disabled={cancellingId === sig.id}
                          onClick={() => void handleCancel(sig)}
                        >
                          {cancellingId === sig.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={`
                      text-muted-foreground grid grid-cols-2 gap-2 text-[11px]
                    `}
                  >
                    <span>Sent: {formatRelative(sig.sentAt)}</span>
                    <span>Viewed: {formatRelative(sig.viewedAt)}</span>
                    <span>Signed: {formatRelative(sig.signedAt)}</span>
                    <span>Declined: {formatRelative(sig.declinedAt)}</span>
                  </div>
                  {sig.declineReason ? (
                    <p className="text-destructive mt-1 text-[11px]">
                      Decline reason: {sig.declineReason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
