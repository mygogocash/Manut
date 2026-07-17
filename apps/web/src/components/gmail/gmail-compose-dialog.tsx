"use client";

import { Loader2, Paperclip, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmailRecipientInput } from "@/components/gmail/email-recipient-input";
import { GmailRichTextEditor } from "@/components/gmail/gmail-rich-text-editor";
import type { ComposeDraft } from "@/components/gmail/gmail-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  type GmailSendInput,
  sendGmail,
} from "@/services/integrations.service";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

const EMPTY_DRAFT: ComposeDraft = {
  mode: "new",
  to: "",
  cc: "",
  subject: "",
  bodyHtml: "",
};

export interface PendingAttachment {
  id: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  size: number;
}

interface GmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ComposeDraft | null;
  onSent?: () => void;
}

function titleForMode(mode: ComposeDraft["mode"]): string {
  switch (mode) {
    case "reply":
      return "Reply";
    case "replyAll":
      return "Reply all";
    case "forward":
      return "Forward";
    default:
      return "New message";
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function FieldRow({
  label,
  children,
  actions,
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={`
        border-border flex min-h-10 items-center gap-2 border-b px-1 py-1
      `}
    >
      <span
        className={`
          text-muted-foreground w-14 shrink-0 pl-2 text-sm font-medium
        `}
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1 pr-1">{actions}</div>
      ) : null}
    </div>
  );
}

export function GmailComposeDialog({
  open,
  onOpenChange,
  draft,
  onSent,
}: GmailComposeDialogProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      openedKeyRef.current = null;
      return;
    }
    const d = draft ?? EMPTY_DRAFT;
    const key = `${d.mode}|${d.to}|${d.subject}|${d.inReplyTo ?? ""}`;
    if (openedKeyRef.current === key) return;
    openedKeyRef.current = key;
    setTo(d.to);
    setCc(d.cc);
    setSubject(d.subject);
    setBodyHtml(d.bodyHtml);
    setAttachments([]);
    setShowCc(d.mode === "replyAll" || d.cc.trim().length > 0);
  }, [open, draft]);

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: PendingAttachment[] = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_ATTACHMENTS) break;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} exceeds 10 MB limit`);
        continue;
      }
      const contentBase64 = await fileToBase64(file);
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}`,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64,
        size: file.size,
      });
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Drag-and-drop attachments onto the dialog body (from #495). Outlook
  // lets you drop files anywhere on the compose pane; this matches that.
  // The overlay is `absolute inset-2`; the parent DialogContent is
  // `position: fixed`, which is itself a valid containing block for
  // absolute children, so the overlay lands inside the dialog without
  // needing the parent to also carry `relative`.
  const [dragHover, setDragHover] = useState(false);
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragHover(false);
    if (sending) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) void onPickFiles(files);
  }
  function onDragOver(e: React.DragEvent) {
    if (sending) return;
    // Only show the overlay when a file (not text/HTML) is being dragged.
    const hasFiles = Array.from(e.dataTransfer?.items ?? []).some(
      (it) => it.kind === "file",
    );
    if (!hasFiles) return;
    e.preventDefault();
    setDragHover(true);
  }
  function onDragLeave(e: React.DragEvent) {
    // Only clear when the cursor leaves the dialog container, not when
    // it crosses an internal child boundary.
    if (e.currentTarget === e.target) setDragHover(false);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function send() {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    try {
      const payload: GmailSendInput = {
        to: to.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim() || undefined,
        inReplyTo: draft?.inReplyTo,
        references: draft?.references,
        threadId: draft?.threadId,
        attachments:
          attachments.length > 0
            ? attachments.map(({ filename, mimeType, contentBase64 }) => ({
                filename,
                mimeType,
                contentBase64,
              }))
            : undefined,
      };
      await sendGmail(payload);
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === "GOOGLE_SEND_SCOPE_REQUIRED"
      ) {
        toast.error(err.message, {
          action: {
            label: "Reconnect",
            onClick: () => {
              window.location.href = "/settings?tab=integrations";
            },
          },
        });
      } else {
        const message =
          err instanceof ApiError ? err.message : "Failed to send email";
        toast.error(message);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Top-anchored (#506) so the Send/Cancel footer stays on screen.
          // `!` overrides Tailwind v4's alphabetical ordering on the base
          // DialogContent classes (which ship `fixed top-1/2 -translate-
          // y-1/2 grid gap-4 p-4`). Without the bang on `flex` / `gap-0`
          // / `p-0`, `grid` / `gap-4` / `p-4` win the cascade and the
          // dialog renders as an empty 4-cell grid behind the overlay —
          // i.e. visible blur, no content (#506 regression, #553).
          //
          // `relative` is NOT needed: `position: fixed` is a valid
          // containing block for the `absolute` drag-overlay child.
          // Adding `relative` here loses the `fixed` cascade in Tailwind
          // v4 (`relative` sorts after `fixed` alphabetically), which
          // sends the dialog into the normal document flow off-screen.
          "top-[max(1rem,5vh)]! left-1/2! flex! w-[calc(100%-2rem)] max-w-3xl!",
          `
            -translate-x-1/2! translate-y-0! flex-col gap-0! overflow-hidden
            p-0!
          `,
          `
            grid-rows-none
            sm:max-w-3xl!
          `,
          "h-[min(85dvh,720px)] max-h-[calc(100dvh-2rem)]",
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragHover ? (
          <div
            className={`
              border-primary bg-primary/5 text-primary pointer-events-none
              absolute inset-2 z-50 flex items-center justify-center rounded-md
              border-2 border-dashed text-sm font-medium
            `}
          >
            Drop to attach files
          </div>
        ) : null}
        <DialogHeader
          className={`border-border shrink-0 space-y-0 border-b px-5 py-4`}
        >
          <DialogTitle>{titleForMode((draft ?? EMPTY_DRAFT).mode)}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Outlook-style address block */}
          <div className="border-border border-b">
            <FieldRow
              label="To"
              actions={
                !showCc ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 px-2 text-xs"
                    onClick={() => setShowCc(true)}
                    disabled={sending}
                  >
                    Cc
                  </Button>
                ) : null
              }
            >
              <EmailRecipientInput
                id="gmail-to"
                value={to}
                onChange={setTo}
                disabled={sending}
              />
            </FieldRow>
            {showCc ? (
              <FieldRow label="Cc">
                <EmailRecipientInput
                  id="gmail-cc"
                  value={cc}
                  onChange={setCc}
                  placeholder="Optional recipients"
                  disabled={sending}
                />
              </FieldRow>
            ) : null}
            <FieldRow label="Subject">
              <Input
                id="gmail-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                className={`
                  border-0 bg-transparent shadow-none
                  focus-visible:ring-0
                `}
              />
            </FieldRow>
          </div>

          <div className="space-y-2 px-5 py-4">
            <Label htmlFor="gmail-body" className="text-sm font-medium">
              Body
            </Label>
            <div id="gmail-body">
              <GmailRichTextEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                disabled={sending}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Use the toolbar for bold, colors, font size, links, and inline
              images. Attach files below.
            </p>
          </div>

          <div
            className={`
              border-border flex flex-wrap items-center gap-2 border-t px-5 py-3
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*,image/*"
              className="hidden"
              onChange={(e) => void onPickFiles(e.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || attachments.length >= MAX_ATTACHMENTS}
            >
              <Paperclip className="mr-1 size-3.5" />
              Attach files
            </Button>
          </div>

          {attachments.length > 0 ? (
            <ul className="space-y-1 px-5 pb-3">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className={`
                    bg-muted/50 flex items-center justify-between rounded-md
                    border px-2 py-1.5 text-sm
                  `}
                >
                  <span className="truncate">
                    {a.filename}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({Math.round(a.size / 1024)} KB)
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    onClick={() => removeAttachment(a.id)}
                    disabled={sending}
                    aria-label={`Remove ${a.filename}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter
          className={`border-border bg-popover shrink-0 border-t px-5 py-4`}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void send()}
            disabled={sending || !to.trim() || !subject.trim()}
          >
            {sending ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
