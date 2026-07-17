"use client";

import { ExternalLink, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  type CashAdvanceRequest,
  disburseCashAdvance,
} from "@/services/cash-advance.service";
import { uploadFile } from "@/services/upload.service";

const ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: CashAdvanceRequest | null;
  onDisbursed: (req: CashAdvanceRequest) => void;
}

export function CashAdvanceDisburseDialog({
  open,
  onOpenChange,
  request,
  onDisbursed,
}: Props) {
  const [proofUrl, setProofUrl] = useState("");
  const [proofName, setProofName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setProofUrl("");
    setProofName(null);
    setUploading(false);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, request?.id]);

  async function handleFilePick(file: File) {
    try {
      setUploading(true);
      const uploaded = await uploadFile(file, {
        bucket: "documents",
        purpose: "cash-advance-disbursement-proof",
        linkedTo: "cash-advance",
        linkedId: request?.id,
      });
      setProofUrl(uploaded.url);
      setProofName(uploaded.originalName);
      toast.success("Proof uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleClearProof() {
    setProofUrl("");
    setProofName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleConfirm() {
    if (!request) return;
    if (!proofUrl.trim()) {
      toast.error("Upload a payout proof before marking disbursed");
      return;
    }
    try {
      setSubmitting(true);
      const res = await disburseCashAdvance(request.id, proofUrl.trim());
      onDisbursed(res.data);
      onOpenChange(false);
      toast.success("Marked as disbursed");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to mark disbursed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting && !uploading) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as disbursed</DialogTitle>
          <DialogDescription>
            Upload the bank transfer slip, payment receipt, or supporting
            document before confirming payout for{" "}
            {request ? `CA-${request.requestNumber}` : "this request"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Payout proof (PDF, Excel, or image)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFilePick(f);
              }}
            />
            {proofUrl ? (
              <div
                className={`
                  border-border bg-card flex items-center justify-between gap-2
                  rounded-md border p-2.5 text-sm
                `}
              >
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    text-primary inline-flex min-w-0 items-center gap-1 truncate
                    hover:underline
                  `}
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {proofName ?? "Uploaded file"}
                  </span>
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={submitting || uploading}
                  onClick={handleClearProof}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                disabled={uploading || submitting}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                {uploading ? "Uploading…" : "Choose file"}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting || uploading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!proofUrl || submitting || uploading}
            onClick={() => void handleConfirm()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Confirming…
              </>
            ) : (
              "Mark disbursed"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
