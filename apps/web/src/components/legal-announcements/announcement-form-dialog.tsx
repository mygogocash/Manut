"use client";

import { Loader2, Paperclip, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormDatePicker } from "@/components/shared/form-date-picker";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  ANNOUNCEMENT_KIND_LABELS,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_STATUS_LABELS,
  ANNOUNCEMENT_STATUSES,
  type AnnouncementKind,
  type AnnouncementStatus,
  createAnnouncement,
  type LegalAnnouncement,
  updateAnnouncement,
} from "@/services/legal-announcements.service";
import { uploadFile } from "@/services/upload.service";

const ALL_ENTITY = "__all__";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface AnnouncementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: LegalAnnouncement | null;
  onSaved: (next: LegalAnnouncement) => void;
}

interface DraftAttachment {
  id?: string;
  fileUrl: string;
  fileName: string;
  pending?: File;
}

export function AnnouncementFormDialog({
  open,
  onOpenChange,
  announcement,
  onSaved,
}: AnnouncementFormDialogProps) {
  const isEditing = !!announcement;
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<AnnouncementKind>("policy");
  const [status, setStatus] = useState<AnnouncementStatus>("draft");
  const [entityId, setEntityId] = useState<string>(ALL_ENTITY);
  const [publishedAt, setPublishedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [requiresAck, setRequiresAck] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    if (!open) return;
    listEntities()
      .then((res) => setEntities(res.data))
      .catch(() => setEntities([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (isEditing && announcement) {
      setTitle(announcement.title);
      setBody(announcement.body);
      setKind(announcement.kind);
      setStatus(announcement.status);
      setEntityId(announcement.entityId ?? ALL_ENTITY);
      setPublishedAt(announcement.publishedAt?.slice(0, 10) ?? "");
      setExpiresAt(announcement.expiresAt?.slice(0, 10) ?? "");
      setRequiresAck(announcement.requiresAck);
      setPinned(announcement.pinned);
      setAttachments(
        announcement.attachments.map((a) => ({
          id: a.id,
          fileUrl: a.fileUrl,
          fileName: a.fileName,
        })),
      );
    } else {
      setTitle("");
      setBody("");
      setKind("policy");
      setStatus("draft");
      setEntityId(ALL_ENTITY);
      setPublishedAt("");
      setExpiresAt("");
      setRequiresAck(false);
      setPinned(false);
      setAttachments([]);
    }
  }, [open, isEditing, announcement]);

  const handleAddFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large — max 25 MB");
      return;
    }
    setAttachments((prev) => [
      ...prev,
      { fileUrl: "", fileName: file.name, pending: file },
    ]);
  }, []);

  const handleRemoveAttachment = useCallback((idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSubmitting(true);
    try {
      // Upload pending files first so the payload only carries URLs.
      const uploaded: Array<{ fileUrl: string; fileName: string }> = [];
      for (const att of attachments) {
        if (att.pending) {
          const result = await uploadFile(att.pending, {
            bucket: "documents",
            purpose: "legal-announcement",
          });
          uploaded.push({
            fileUrl: result.url,
            fileName: result.originalName,
          });
        } else {
          uploaded.push({ fileUrl: att.fileUrl, fileName: att.fileName });
        }
      }

      // Convert date-picker values to ISO timestamps the API expects.
      const toIso = (val: string) =>
        val ? new Date(`${val}T00:00:00Z`).toISOString() : undefined;

      const payload = {
        title: title.trim(),
        body,
        kind,
        status,
        entityId: entityId === ALL_ENTITY ? undefined : entityId,
        publishedAt: toIso(publishedAt),
        expiresAt: toIso(expiresAt),
        requiresAck,
        pinned,
        attachments: uploaded,
      };

      if (isEditing && announcement) {
        const res = await updateAnnouncement(announcement.id, payload);
        toast.success("Announcement updated");
        onSaved(res.data);
      } else {
        const res = await createAnnouncement(payload);
        toast.success("Announcement created");
        onSaved(res.data);
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save announcement";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    title,
    body,
    kind,
    status,
    entityId,
    publishedAt,
    expiresAt,
    requiresAck,
    pinned,
    attachments,
    isEditing,
    announcement,
    onSaved,
    onOpenChange,
  ]);

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
            {isEditing ? "Edit announcement" : "New announcement"}
          </DialogTitle>
          <DialogDescription>
            Internal legal notice — published items appear on every
            employee&apos;s dashboard until expiry. Required-ack items show a
            banner until each employee acknowledges.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Change in authorised signatories — May 2026"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Kind</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as AnnouncementKind)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ANNOUNCEMENT_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as AnnouncementStatus)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ANNOUNCEMENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Entity</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ENTITY}>All entities</SelectItem>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Body *</Label>
            <div className="mt-1">
              <RichTextEditor value={body} onChange={setBody} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Publish date</Label>
              <FormDatePicker value={publishedAt} onChange={setPublishedAt} />
              <p className="text-muted-foreground mt-1 text-[11px]">
                Leave blank to auto-stamp when status flips to Published.
              </p>
            </div>
            <div>
              <Label className="text-xs">Expiry date</Label>
              <FormDatePicker value={expiresAt} onChange={setExpiresAt} />
              <p className="text-muted-foreground mt-1 text-[11px]">
                After expiry the announcement stays readable but is no longer
                outstanding.
              </p>
            </div>
          </div>

          <div
            className={`
              flex flex-col gap-3
              sm:flex-row sm:items-center sm:justify-between
            `}
          >
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={requiresAck} onCheckedChange={setRequiresAck} />
              Require employees to acknowledge
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={pinned} onCheckedChange={setPinned} />
              Pin to top
            </label>
          </div>

          <div>
            <Label className="text-xs">Attachments</Label>
            <div className="mt-1 flex flex-col gap-2">
              {attachments.length === 0 ? (
                <p
                  className={`
                    text-muted-foreground rounded border border-dashed px-3 py-2
                    text-center text-xs
                  `}
                >
                  No attachments
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {attachments.map((att, idx) => (
                    <li
                      key={att.id ?? `pending-${idx}`}
                      className={`
                        border-border bg-surface flex items-center gap-2 rounded
                        border px-2 py-1.5 text-xs
                      `}
                    >
                      <Paperclip className="size-3.5 shrink-0" />
                      <span className="flex-1 truncate">{att.fileName}</span>
                      {att.pending ? (
                        <span className="text-muted-foreground text-[11px]">
                          ready to upload
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={`
                          text-muted-foreground p-1
                          hover:text-destructive
                        `}
                        aria-label={`Remove ${att.fileName}`}
                        onClick={() => handleRemoveAttachment(idx)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAddFile(f);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Add file
              </Button>
            </div>
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
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
