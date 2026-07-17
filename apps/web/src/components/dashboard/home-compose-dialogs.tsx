"use client";

import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { createDate } from "@/services/company-date.service";
import { createNews } from "@/services/news.service";
import { uploadFile } from "@/services/upload.service";
import { createPost } from "@/services/wall.service";

interface Attachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

// Shared image + PDF picker — pushes the file through the existing
// /api/uploads/multipart endpoint, then surfaces an editable chip list.
// Capped at 5 attachments per item to keep the dashboard summary cards
// scannable; backend allows 10.
const MAX_ATTACHMENTS = 5;
const UPLOAD_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf";

function AttachmentPicker({
  value,
  onChange,
  disabled,
}: {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handlePick(file: File) {
    if (value.length >= MAX_ATTACHMENTS) {
      toast.error(`Up to ${MAX_ATTACHMENTS} attachments per post`);
      return;
    }
    try {
      setUploading(true);
      const res = await uploadFile(file, {
        bucket: "uploads",
        purpose: "home-compose",
      });
      onChange([
        ...value,
        {
          name: res.originalName,
          url: res.url,
          mimeType: res.mimeType,
          size: res.size,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handlePick(f);
        }}
      />
      {value.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {value.map((att, idx) => {
            const isImage = (att.mimeType ?? "").startsWith("image/");
            const Icon = isImage ? ImageIcon : FileText;
            return (
              <li
                key={`${att.url}-${idx}`}
                className={`
                  bg-muted/40 flex items-center gap-2 rounded-md border px-2.5
                  py-1.5 text-xs
                `}
              >
                <Icon
                  className="text-muted-foreground size-3.5 shrink-0"
                  aria-hidden
                />
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    min-w-0 flex-1 truncate
                    hover:underline
                  `}
                >
                  {att.name}
                </a>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label={`Remove ${att.name}`}
                  className={`
                    text-muted-foreground
                    hover:text-destructive
                  `}
                  disabled={disabled}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading || value.length >= MAX_ATTACHMENTS}
        >
          {uploading ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Paperclip className="mr-1 size-3.5" />
          )}
          {value.length === 0 ? "Add image or PDF" : "Add another"}
        </Button>
      </div>
    </div>
  );
}

// Wall post types match the API enum (see wall.validation.ts). Defaults
// to "post" — the only widely-used value on the dashboard surface.
const WALL_POST_TYPES = ["post", "announcement", "achievement"] as const;
type WallPostType = (typeof WALL_POST_TYPES)[number];

const NEWS_CATEGORIES = [
  "general",
  "people",
  "product",
  "operations",
  "finance",
] as const;
type NewsCategory = (typeof NEWS_CATEGORIES)[number];

const COMPANY_DATE_TYPES = [
  "holiday",
  "event",
  "milestone",
  "deadline",
] as const;
type CompanyDateType = (typeof COMPANY_DATE_TYPES)[number];

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * Compose-new dialog for a wall post. Posts straight to /wall/ via the
 * existing service; on success the parent triggers a dashboard refetch.
 */
export function WallPostComposeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [content, setContent] = useState("");
  const [type, setType] = useState<WallPostType>("post");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setContent("");
      setType("post");
      setAttachments([]);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Post content can't be empty");
      return;
    }
    try {
      setSubmitting(true);
      await createPost({
        content: trimmed,
        type,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      toast.success("Posted to the company wall");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(describeError(err, "Failed to post"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New wall post</DialogTitle>
          <DialogDescription>
            Share an update with everyone in the workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="wall-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as WallPostType)}
            >
              <SelectTrigger id="wall-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WALL_POST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="wall-content">Message</Label>
            <Textarea
              id="wall-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={5}
              autoFocus
            />
          </div>
          <div>
            <Label>Attachments</Label>
            <AttachmentPicker
              value={attachments}
              onChange={setAttachments}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !content.trim()}
          >
            {submitting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compose-new dialog for a company-news headline. Mirrors the wall
 * dialog's shape so the dashboard's three "+" buttons stay consistent.
 */
export function NewsComposeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<NewsCategory>("general");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
      setCategory("general");
      setAttachments([]);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit() {
    const t = title.trim();
    const c = content.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }
    if (!c) {
      toast.error("Content is required");
      return;
    }
    try {
      setSubmitting(true);
      await createNews({
        title: t,
        content: c,
        category,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      toast.success("News published");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(describeError(err, "Failed to publish news"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New company news</DialogTitle>
          <DialogDescription>
            Publish an announcement to the home page.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="news-title">Title</Label>
            <Input
              id="news-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q3 OKRs are live"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="news-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as NewsCategory)}
            >
              <SelectTrigger id="news-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NEWS_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="news-content">Body</Label>
            <Textarea
              id="news-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What changed and why."
              rows={6}
            />
          </div>
          <div>
            <Label>Attachments</Label>
            <AttachmentPicker
              value={attachments}
              onChange={setAttachments}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compose-new dialog for a company date. `date` is a YYYY-MM-DD string
 * we send straight to the API — the service serialises to a Prisma Date
 * column on the backend.
 */
export function CompanyDateComposeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<CompanyDateType>("event");
  const [location, setLocation] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDate(new Date().toISOString().slice(0, 10));
      setType("event");
      setLocation("");
      setAttachments([]);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit() {
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("Pick a valid date");
      return;
    }
    try {
      setSubmitting(true);
      await createDate({
        title: t,
        date,
        type,
        location: location.trim() || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      toast.success("Date added to the calendar");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(describeError(err, "Failed to add date"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New company date</DialogTitle>
          <DialogDescription>
            Add a holiday, milestone, or event to the home-page calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="date-title">Title</Label>
            <Input
              id="date-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Songkran public holiday"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date-date">Date</Label>
              <FormDatePicker value={date} onChange={setDate} />
            </div>
            <div>
              <Label htmlFor="date-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CompanyDateType)}
              >
                <SelectTrigger id="date-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_DATE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="date-location">Location (optional)</Label>
            <Input
              id="date-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Bangkok HQ"
            />
          </div>
          <div>
            <Label className="mb-1">Attachments</Label>
            <AttachmentPicker
              value={attachments}
              onChange={setAttachments}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !title.trim()}
          >
            {submitting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
