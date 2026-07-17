"use client";

import { CalendarClock, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormDatePicker } from "@/components/shared/form-date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  createLegalAttachment,
  deleteLegalAttachment,
  getLegalAttachmentDownloadUrl,
  LEGAL_ATTACHMENT_KIND_LABELS,
  LEGAL_ATTACHMENT_KINDS,
  type LegalAttachment,
  type LegalAttachmentKind,
  type LegalDocument,
} from "@/services/legal.service";
import { uploadFile } from "@/services/upload.service";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPT_EXT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.csv,.zip";

interface LegalAttachmentsSectionProps {
  documentId: string;
  attachments: LegalAttachment[];
  canEdit: boolean;
  onChanged: (next: LegalDocument | null) => void;
}

export function LegalAttachmentsSection({
  documentId,
  attachments,
  canEdit,
  onChanged,
}: LegalAttachmentsSectionProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...attachments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [attachments],
  );

  const handleDownload = useCallback(async (att: LegalAttachment) => {
    try {
      const res = await getLegalAttachmentDownloadUrl(att.documentId, att.id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to open file";
      toast.error(message);
    }
  }, []);

  const handleDelete = useCallback(
    async (att: LegalAttachment) => {
      if (!confirm(`Remove "${att.fileName}"?`)) return;
      try {
        setBusyId(att.id);
        const res = await deleteLegalAttachment(documentId, att.id);
        toast.success("Attachment removed");
        onChanged(res.data.document);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to remove";
        toast.error(message);
      } finally {
        setBusyId(null);
      }
    },
    [documentId, onChanged],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-foreground text-sm font-medium">
            Supporting documents
          </p>
          <p className="text-muted-foreground text-xs">
            Addenda, amendments, renewal letters — the latest expiry across this
            set drives the contract status.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3.5" />
            Add file
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p
          className={`
            text-muted-foreground rounded-md border border-dashed px-3 py-3
            text-center text-xs
          `}
        >
          No supporting documents yet.
        </p>
      ) : (
        <ul className="border-border flex flex-col gap-2">
          {sorted.map((att) => (
            <li
              key={att.id}
              className={`
                border-border bg-surface flex items-center gap-3 rounded-md
                border px-3 py-2
              `}
            >
              <FileText className="text-bronze size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className={`
                    text-primary block max-w-full truncate text-left text-xs
                    font-medium
                    hover:underline
                  `}
                  onClick={() => void handleDownload(att)}
                  title={att.fileName}
                >
                  {att.label || att.fileName}
                </button>
                <div
                  className={`
                    text-muted-foreground mt-0.5 flex flex-wrap items-center
                    gap-x-2 gap-y-0.5 text-[11px]
                  `}
                >
                  <span className="capitalize">
                    {LEGAL_ATTACHMENT_KIND_LABELS[att.kind] ?? att.kind}
                  </span>
                  {att.effectiveDate ? (
                    <span>· effective {att.effectiveDate}</span>
                  ) : null}
                  {att.expiryDate ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" />
                      expires {att.expiryDate}
                    </span>
                  ) : null}
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Remove ${att.fileName}`}
                  className={`
                    text-muted-foreground rounded p-1
                    hover:text-destructive
                    disabled:opacity-50
                  `}
                  disabled={busyId === att.id}
                  onClick={() => void handleDelete(att)}
                >
                  {busyId === att.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddAttachmentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        documentId={documentId}
        onAdded={onChanged}
      />
    </div>
  );
}

interface AddAttachmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  onAdded: (doc: LegalDocument | null) => void;
}

function AddAttachmentDialog({
  open,
  onOpenChange,
  documentId,
  onAdded,
}: AddAttachmentDialogProps) {
  const [kind, setKind] = useState<LegalAttachmentKind>("addendum");
  const [label, setLabel] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setKind("addendum");
    setLabel("");
    setEffectiveDate("");
    setExpiryDate("");
    setFile(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) {
      toast.error("Pick a file first");
      return;
    }
    try {
      setSubmitting(true);
      const uploaded = await uploadFile(file, {
        bucket: "documents",
        purpose: "legal-document-attachment",
      });
      const res = await createLegalAttachment(documentId, {
        kind,
        label: label.trim() || undefined,
        fileUrl: uploaded.url,
        fileName: uploaded.originalName,
        effectiveDate: effectiveDate || undefined,
        expiryDate: expiryDate || undefined,
      });
      toast.success("Attachment added");
      onAdded(res.data.document);
      reset();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to add attachment";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    file,
    kind,
    label,
    effectiveDate,
    expiryDate,
    documentId,
    onAdded,
    onOpenChange,
    reset,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add supporting document</DialogTitle>
          <DialogDescription>
            Group an addendum, amendment, renewal letter or signed PDF under
            this contract.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-foreground text-xs font-medium">
                Kind
              </label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as LegalAttachmentKind)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_ATTACHMENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {LEGAL_ATTACHMENT_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-foreground text-xs font-medium">
                Label
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Addendum No. 1"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-foreground text-xs font-medium">
                Effective date
              </label>
              <FormDatePicker
                value={effectiveDate}
                onChange={setEffectiveDate}
              />
            </div>
            <div>
              <label className="text-foreground text-xs font-medium">
                Expiry date
              </label>
              <FormDatePicker value={expiryDate} onChange={setExpiryDate} />
            </div>
          </div>

          <div>
            <label className="text-foreground text-xs font-medium">File</label>
            <input
              type="file"
              accept={ACCEPT_EXT}
              className="mt-1 block w-full text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > MAX_FILE_BYTES) {
                  toast.error("File too large — max 25 MB");
                  return;
                }
                setFile(f);
              }}
            />
            {file ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !file}
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
