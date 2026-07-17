"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { RemoteUserPicker } from "@/components/crm/remote-user-picker";
import { LegalAttachmentsSection } from "@/components/legal/legal-attachments-section";
import {
  LEGAL_FORM_DEFAULTS,
  type LegalFormInput,
  legalFormSchema,
  type LegalFormValues,
} from "@/components/legal/legal-form-schema";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import type { Entity } from "@/services/entity.service";
import {
  ALERT_CATEGORY_OPTIONS,
  createLegalDocument,
  getLegalDocument,
  LEGAL_KIND_LABELS,
  LEGAL_KINDS,
  LEGAL_STATUS_LABELS,
  LEGAL_STATUSES,
  type LegalAlertCategory,
  type LegalDocument,
  type LegalDocumentListItem,
  updateLegalDocument,
} from "@/services/legal.service";
import { uploadFile } from "@/services/upload.service";

interface LegalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: LegalDocument | LegalDocumentListItem | null;
  entities: Entity[];
  folders?: string[];
  onSaved: (doc: LegalDocument) => void;
}

export function LegalFormDialog({
  open,
  onOpenChange,
  document,
  entities,
  folders = [],
  onSaved,
}: LegalFormDialogProps) {
  const isEditing = !!document;
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<LegalDocument | null>(
    document && "notes" in document && document.notes !== undefined
      ? (document as LegalDocument)
      : null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
  const ACCEPT_EXT =
    ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.csv,.zip";

  function pickFromDataTransfer(dt: DataTransfer): File | null {
    if (dt.files && dt.files.length > 0) return dt.files[0] ?? null;
    if (dt.items) {
      for (const item of dt.items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) return f;
        }
      }
    }
    return null;
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function acceptFile(f: File): boolean {
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`File too large — max ${formatBytes(MAX_FILE_BYTES)}`);
      return false;
    }
    setPendingFile(f);
    form.setValue("fileName", f.name);
    return true;
  }

  const form = useForm<LegalFormInput, unknown, LegalFormValues>({
    resolver: standardSchemaResolver(legalFormSchema),
    defaultValues: LEGAL_FORM_DEFAULTS,
  });

  // Fetch full detail when editing — list item may be slim.
  useEffect(() => {
    if (!open) {
      setDetail(null);
      setPendingFile(null);
      return;
    }
    if (!document?.id) return;

    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await getLegalDocument(document.id);
        if (!cancelled) setDetail(res.data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, document?.id]);

  useEffect(() => {
    if (!open) return;
    if (isEditing && detail) {
      form.reset({
        title: detail.title,
        kind: detail.kind,
        reference: detail.reference ?? "",
        parties: (detail.parties ?? []).join("\n"),
        ownerId: detail.owner?.id ?? "",
        entityId: detail.entity?.id ?? "",
        effectiveDate: detail.effectiveDate ?? "",
        expiryDate: detail.expiryDate ?? "",
        renewalLeadDays: detail.renewalLeadDays,
        status: detail.status,
        fileUrl: detail.fileUrl ?? "",
        fileName: detail.fileName ?? "",
        folder: detail.folder ?? "",
        alertCategory: detail.alertCategory ?? "",
        notes: detail.notes ?? "",
      });
    } else if (!isEditing) {
      // Default owner to the current user so legal staff can create a
      // document in one click without first searching the directory
      // picker — also avoids a hard dependency on `directory:read`,
      // which not every legal role holds.
      form.reset({
        ...LEGAL_FORM_DEFAULTS,
        ownerId: user?.id ?? "",
      });
    }
  }, [detail, form, isEditing, open, user?.id]);

  const onSubmit = useCallback(
    async (values: LegalFormValues) => {
      try {
        setSubmitting(true);

        let fileUrl = values.fileUrl || undefined;
        let fileName = values.fileName || undefined;
        if (pendingFile) {
          const uploaded = await uploadFile(pendingFile, {
            bucket: "documents",
            purpose: "legal-document",
          });
          fileUrl = uploaded.url;
          fileName = uploaded.originalName;
        }

        const partiesArray = (values.parties ?? "")
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 20);

        const payload = {
          title: values.title,
          kind: values.kind,
          reference: values.reference || undefined,
          parties: partiesArray,
          ownerId: values.ownerId ? values.ownerId : null,
          entityId: values.entityId || undefined,
          effectiveDate: values.effectiveDate || undefined,
          expiryDate: values.expiryDate || undefined,
          renewalLeadDays: values.renewalLeadDays,
          status: values.status,
          fileUrl,
          fileName,
          folder: values.folder?.trim() || undefined,
          // Empty string → null (no alert category). Options are constrained
          // to the enum by the Select, so the cast is safe.
          alertCategory: (values.alertCategory ||
            null) as LegalAlertCategory | null,
          notes: values.notes || undefined,
        };

        if (isEditing && document) {
          const res = await updateLegalDocument(document.id, payload);
          toast.success("Document updated");
          onSaved(res.data);
        } else {
          const res = await createLegalDocument(payload);
          toast.success("Document created");
          onSaved(res.data);
        }
        onOpenChange(false);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Something went wrong";
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [isEditing, document, onSaved, onOpenChange, pendingFile],
  );

  const initialOwnerOption = detail?.owner
    ? {
        id: detail.owner.id,
        name: detail.owner.name,
        email: detail.owner.email,
        avatarUrl: null,
        jobTitle: null,
      }
    : !isEditing && user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          jobTitle: user.jobTitle,
        }
      : null;

  const editingDetailMissing = isEditing && !detail;
  const currentFileName = pendingFile?.name ?? form.watch("fileName");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit legal document" : "Add legal document"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update ${document?.title ?? "this document"}.`
              : "Track a licence, agreement or other legal record with expiry alerts."}
          </DialogDescription>
        </DialogHeader>

        {editingDetailMissing && detailLoading ? (
          <div
            className={`
              text-muted-foreground flex items-center justify-center gap-2 py-12
              text-xs
            `}
          >
            <Loader2 className="size-3.5 animate-spin" />
            Loading document…
          </div>
        ) : null}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={
              editingDetailMissing && detailLoading
                ? "hidden"
                : "flex flex-col gap-4"
            }
            id="legal-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. AI service agreement" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kind *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LEGAL_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {LEGAL_KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contract / licence number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="parties"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Counterparties</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="One per line (max 20)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner</FormLabel>
                    <FormControl>
                      <RemoteUserPicker
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        initialOption={initialOwnerOption}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity</FormLabel>
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) =>
                        field.onChange(v === "__none__" ? "" : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="No entity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No entity</SelectItem>
                        {entities.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="folder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder</FormLabel>
                  <FormControl>
                    <Input
                      list="legal-folder-suggestions"
                      placeholder="e.g. Token Agreements, NDAs, Service Contracts"
                      {...field}
                    />
                  </FormControl>
                  {folders.length > 0 ? (
                    <datalist id="legal-folder-suggestions">
                      {folders.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="alertCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert category</FormLabel>
                  <Select
                    value={field.value || "__none__"}
                    onValueChange={(v) =>
                      field.onChange(v === "__none__" ? "" : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">
                        — None (no alerts) —
                      </SelectItem>
                      {ALERT_CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Controls which Legal notification digest this document
                    appears in. Untagged documents are never alerted.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective date</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="renewalLeadDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Renewal lead (days)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={365} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEGAL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {LEGAL_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Document upload — drag-and-drop zone. Bucket is "documents"
                in Supabase storage; keep both URL and original filename
                so the table renders a labelled link. */}
            <div className="flex flex-col gap-2">
              <FormLabel>Document</FormLabel>
              {currentFileName ? (
                <div
                  className={`
                    border-bronze/30 bg-bronze/5 flex items-center gap-3
                    rounded-lg border px-3 py-2.5
                  `}
                >
                  <FileText className="text-bronze size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {currentFileName}
                    </div>
                    {pendingFile ? (
                      <div className="text-muted-foreground text-xs">
                        {formatBytes(pendingFile.size)} — ready to upload on
                        save
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-xs">
                        Existing attachment
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Remove file"
                    className={`
                      text-muted-foreground rounded p-1
                      hover:text-foreground hover:bg-bronze/10
                    `}
                    onClick={() => {
                      setPendingFile(null);
                      form.setValue("fileUrl", "");
                      form.setValue("fileName", "");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
                    setDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOver(false);
                    const f = pickFromDataTransfer(e.dataTransfer);
                    if (!f) {
                      toast.error("Could not read the dropped file");
                      return;
                    }
                    acceptFile(f);
                  }}
                  className={[
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
                    dragOver
                      ? "border-bronze bg-bronze/10"
                      : "border-bronze/40 hover:bg-bronze/5",
                  ].join(" ")}
                >
                  <UploadCloud className="text-bronze size-8" />
                  <div className="text-sm font-medium">
                    Drop file here or click to browse
                  </div>
                  <div className="text-muted-foreground text-xs">
                    PDF, Word, Excel, image — up to{" "}
                    {formatBytes(MAX_FILE_BYTES)}
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_EXT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) acceptFile(f);
                }}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Optional notes…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        {isEditing && detail ? (
          <div className="border-border mt-2 border-t pt-4">
            <LegalAttachmentsSection
              documentId={detail.id}
              attachments={detail.attachments ?? []}
              canEdit
              onChanged={(next) => {
                if (next) {
                  setDetail(next);
                  onSaved(next);
                }
              }}
            />
          </div>
        ) : null}

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
            type="submit"
            form="legal-form"
            disabled={submitting || editingDetailMissing}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
