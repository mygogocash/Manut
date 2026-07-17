"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, Paperclip, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  createTicket,
  type HelpdeskTicket,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_HINTS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  type TicketAttachment,
} from "@/services/helpdesk.service";
import { uploadFile } from "@/services/upload.service";

const MAX_ATTACHMENTS = 10;

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ticketFormSchema = z.object({
  title: z.string().min(3, "Title is required").max(200),
  description: z.string().min(5, "Describe the issue").max(5000),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface TicketCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (ticket: HelpdeskTicket) => void;
}

export function TicketCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: TicketCreateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<TicketFormValues>({
    resolver: standardSchemaResolver(ticketFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "other",
      priority: "medium",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        description: "",
        category: "other",
        priority: "medium",
      });
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, form]);

  const handleFilesPicked = useCallback(
    async (filesList: FileList | File[] | null) => {
      if (!filesList) return;
      const incoming = Array.from(filesList);
      if (incoming.length === 0) return;
      const remaining = MAX_ATTACHMENTS - attachments.length;
      if (remaining <= 0) {
        toast.error(`Attachment limit reached (max ${MAX_ATTACHMENTS}).`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const toUpload = incoming.slice(0, remaining);
      if (toUpload.length < incoming.length) {
        toast.warning(
          `Only the first ${toUpload.length} file(s) were queued — limit is ${MAX_ATTACHMENTS}.`,
        );
      }
      try {
        setUploading(true);
        // Sequential upload keeps the in-flight log readable and lets the
        // user know exactly which file failed if the bucket rejects one.
        const uploaded: TicketAttachment[] = [];
        for (const file of toUpload) {
          const res = await uploadFile(file, {
            bucket: "uploads",
            purpose: "helpdesk-ticket",
          });
          uploaded.push({
            name: res.originalName,
            url: res.url,
            mimeType: res.mimeType,
            size: res.size,
          });
        }
        setAttachments((prev) => [...prev, ...uploaded]);
        toast.success(
          uploaded.length === 1
            ? "Attachment uploaded"
            : `${uploaded.length} attachments uploaded`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [attachments.length],
  );

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  // Cmd/Ctrl+V on the dialog pastes a screenshot from the clipboard
  // straight into Attachments. Skip when the user is mid-typing in
  // an input / textarea — that should keep its normal paste-text
  // behaviour. Only fires while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        if (item.kind !== "file") continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        if (!blob.type.startsWith("image/")) continue;
        const ext = blob.type.split("/")[1] || "png";
        const named = new File(
          [blob],
          blob.name && blob.name !== "image.png"
            ? blob.name
            : `screenshot-${stamp}.${ext}`,
          { type: blob.type, lastModified: Date.now() },
        );
        files.push(named);
      }
      if (files.length === 0) return;
      e.preventDefault();
      void handleFilesPicked(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, handleFilesPicked]);

  async function onSubmit(values: TicketFormValues) {
    try {
      setSubmitting(true);
      const res = await createTicket({
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        priority: values.priority,
        ...(attachments.length > 0 && { attachments }),
      });
      toast.success(`Ticket IT-${res.data.ticketNumber} submitted`);
      onCreated?.(res.data);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to submit ticket";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const category = form.watch("category");
  const attachmentCount = attachments.length;
  const attachmentsFull = attachmentCount >= MAX_ATTACHMENTS;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          flex max-h-[90vh] flex-col overflow-hidden
          sm:max-w-xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Submit IT helpdesk ticket</DialogTitle>
          <DialogDescription>
            Pick the category that best fits the issue. The IT team will pick it
            up from the Kanban board.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
            id="helpdesk-ticket-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. Reset my email password"
                      maxLength={200}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className={`
                grid gap-4
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TICKET_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {TICKET_CATEGORY_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {TICKET_CATEGORY_HINTS[category]}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TICKET_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {TICKET_PRIORITY_LABELS[p]}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Steps to reproduce, error messages, affected service, urgency drivers..."
                      maxLength={5000}
                      rows={6}
                    />
                  </FormControl>
                  <FormDescription>
                    Mention the affected service / device / account so IT can
                    triage without a follow-up.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Attachments</Label>
                <span className="text-muted-foreground text-xs">
                  {attachmentCount} / {MAX_ATTACHMENTS}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain"
                onChange={(e) => void handleFilesPicked(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || submitting || attachmentsFull}
              >
                {uploading ? (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                ) : (
                  <Paperclip className="mr-2 size-3.5" />
                )}
                {uploading ? "Uploading..." : "Add files"}
              </Button>
              <p className="text-muted-foreground text-xs">
                Screenshots, photos, PDFs, or office docs. Up to{" "}
                {MAX_ATTACHMENTS} files, 50 MB each.{" "}
                <span className="opacity-80">
                  Tip: press ⌘V / Ctrl+V to paste a screenshot.
                </span>
              </p>
              {attachmentCount > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {attachments.map((att, idx) => (
                    <li
                      key={`${att.url}-${idx}`}
                      className={`
                        bg-muted/40 flex items-center justify-between gap-2
                        rounded-md border px-3 py-1.5 text-sm
                      `}
                    >
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
                          flex min-w-0 flex-1 items-center gap-2 truncate
                          hover:underline
                        `}
                      >
                        <Paperclip
                          className={`text-muted-foreground size-3.5 shrink-0`}
                        />
                        <span className="truncate">{att.name}</span>
                        {att.size ? (
                          <span
                            className={`text-muted-foreground shrink-0 text-xs`}
                          >
                            {formatBytes(att.size)}
                          </span>
                        ) : null}
                      </a>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0"
                        onClick={() => removeAttachment(idx)}
                        disabled={submitting}
                        aria-label={`Remove ${att.name}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting || uploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="helpdesk-ticket-form"
            disabled={submitting || uploading}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Submit ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
