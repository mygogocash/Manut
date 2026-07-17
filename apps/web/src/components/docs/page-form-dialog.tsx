"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  ExternalLink,
  FolderUp,
  Loader2,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import {
  createWikiPage,
  updateWikiPage,
  type WikiPage,
  type WikiPageAttachment,
  type WikiPageListItem,
} from "@/services/docs.service";
import { uploadFile } from "@/services/upload.service";

const NO_PARENT = "__none__";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  body: z.string().min(1, "Body is required").max(262_144),
  parentId: z.string(),
  folder: z.string().max(100).optional().or(z.literal("")),
  slug: z
    .string()
    .max(150)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters / digits / hyphens only")
    .optional()
    .or(z.literal("")),
  isPublished: z.boolean(),
  isRestricted: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_DEFAULTS: FormValues = {
  title: "",
  body: "",
  parentId: NO_PARENT,
  folder: "",
  slug: "",
  isPublished: true,
  isRestricted: false,
};

interface PageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page?: WikiPage | null;
  /** Parent candidates (excludes the page being edited and its descendants). */
  candidates?: WikiPageListItem[];
  /** Pre-selected parent when creating from "Add child page" affordance. */
  defaultParentId?: string | null;
  onSaved: (page: WikiPage) => void;
}

export function PageFormDialog({
  open,
  onOpenChange,
  page,
  candidates,
  defaultParentId,
  onSaved,
}: PageFormDialogProps) {
  const isEditing = !!page;
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<WikiPageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  // Filter parent options to exclude the editing page and its descendants
  // — preventing cycles is enforced server-side too, but a graceful UI
  // hides the bad options before the user picks them.
  const parentOptions = useMemo(() => {
    const all = candidates ?? [];
    if (!page) return all;
    const blocked = new Set<string>([page.id]);
    let added = true;
    while (added) {
      added = false;
      for (const c of all) {
        if (c.parentId && blocked.has(c.parentId) && !blocked.has(c.id)) {
          blocked.add(c.id);
          added = true;
        }
      }
    }
    return all.filter((c) => !blocked.has(c.id));
  }, [candidates, page]);

  useEffect(() => {
    if (!open) return;
    if (page) {
      form.reset({
        title: page.title,
        body: page.body,
        parentId: page.parentId ?? NO_PARENT,
        folder: page.folder ?? "",
        slug: page.slug ?? "",
        isPublished: page.isPublished,
        isRestricted: page.isRestricted,
      });
      setAttachments(page.attachments ?? []);
    } else {
      form.reset({
        ...EMPTY_DEFAULTS,
        parentId: defaultParentId ?? NO_PARENT,
      });
      setAttachments([]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, page, defaultParentId, form]);

  async function handleFilePick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    // Upload each file under its own try/catch. The previous shape
    // had a single try around the whole loop, so one rejected file
    // (e.g. a MIME the server doesn't allow — `application/octet-
    // stream`) aborted the loop and silently dropped every file
    // that had already uploaded. Now successful files attach and
    // rejected ones surface an individual toast.
    const fileList = Array.from(files);
    const uploaded: WikiPageAttachment[] = [];
    const failures: string[] = [];
    for (const file of fileList) {
      try {
        const res = await uploadFile(file, {
          bucket: "uploads",
          purpose: "wiki-attachment",
        });
        uploaded.push({
          url: res.url,
          name: res.originalName,
          mimeType: res.mimeType,
          size: res.size,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        failures.push(`${file.name}: ${msg}`);
      }
    }
    if (uploaded.length > 0) {
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success(
        `${uploaded.length} file${uploaded.length === 1 ? "" : "s"} attached`,
      );
    }
    for (const msg of failures) toast.error(msg);
    setUploading(false);
    // Reset both pickers so the same selection can be re-chosen
    // (e.g. user fixes a folder's contents and re-uploads).
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        title: values.title,
        body: values.body,
        parentId: values.parentId === NO_PARENT ? null : values.parentId,
        folder: values.folder || undefined,
        slug: values.slug || undefined,
        isPublished: values.isPublished,
        isRestricted: values.isRestricted,
        attachments,
      };
      const res = isEditing
        ? await updateWikiPage(page!.id, payload)
        : await createWikiPage(payload);
      toast.success(isEditing ? "Page updated" : "Page created");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save page";
      toast.error(message);
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
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-3xl
        `}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit page" : "New page"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update "${page?.title}".`
              : "Create a wiki page. Pick a parent to nest it inside an existing page."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="docs-page-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Marketing onboarding playbook"
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
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent page</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None (top level)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PARENT}>
                          None (top level)
                        </SelectItem>
                        {parentOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose where this page nests in the tree.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="marketing-onboarding"
                        className="font-mono text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional. Defaults to the page id when empty.
                    </FormDescription>
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
                  <FormLabel>Legacy folder label</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Marketing / HR / Engineering / …"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional free-text label kept from the flat layout. New work
                    should rely on the parent picker above.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body *</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Write the page content…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2 rounded-md border px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-sm">Attachments</Label>
                  <p className="text-muted-foreground text-[11px]">
                    Documents, sheets, PDFs, images, video — up to 50&nbsp;MB
                    each.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFilePick(e.target.files)}
                />
                {/* Folder picker. `webkitdirectory` + `directory` are
                    non-standard but supported in Chromium, WebKit, and
                    Firefox; the browser hands us a FileList containing
                    every file inside the chosen folder (recursive),
                    which the same handler uploads one-by-one. Setting
                    the attributes via the ref callback avoids the
                    TypeScript JSX prop-name check. */}
                <input
                  ref={(el) => {
                    folderInputRef.current = el;
                    if (el) {
                      el.setAttribute("webkitdirectory", "");
                      el.setAttribute("directory", "");
                    }
                  }}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFilePick(e.target.files)}
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || submitting}
                  >
                    {uploading ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1 size-3.5" />
                    )}
                    Add files
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={uploading || submitting}
                    title="Pick a folder; every file inside uploads"
                  >
                    <FolderUp className="mr-1 size-3.5" />
                    Add folder
                  </Button>
                </div>
              </div>
              {attachments.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {attachments.map((a, idx) => (
                    <li
                      key={`${a.url}-${idx}`}
                      className={`
                        border-border bg-card flex items-center justify-between
                        gap-2 rounded-md border px-2.5 py-1.5 text-[12px]
                      `}
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
                          text-primary inline-flex min-w-0 items-center gap-1.5
                          truncate
                          hover:underline
                        `}
                      >
                        <Paperclip className="size-3.5 shrink-0" />
                        <span className="truncate">{a.name}</span>
                        <ExternalLink className="size-3 shrink-0 opacity-60" />
                      </a>
                      <div
                        className={`
                          text-muted-foreground flex items-center gap-2
                          text-[11px]
                        `}
                      >
                        <span className="tabular-nums">
                          {formatBytes(a.size)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(idx)}
                          disabled={submitting}
                          aria-label={`Remove ${a.name}`}
                          className="h-6 w-6 p-0"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <FormField
              control={form.control}
              name="isPublished"
              render={({ field }) => (
                <FormItem
                  className={`
                    flex items-center justify-between rounded-md border px-3
                    py-2.5
                  `}
                >
                  <div>
                    <FormLabel className="mb-0 cursor-pointer">
                      Published
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      Unpublished pages stay hidden from non-authors.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isRestricted"
              render={({ field }) => (
                <FormItem
                  className={`
                    flex items-center justify-between rounded-md border px-3
                    py-2.5
                  `}
                >
                  <div>
                    <FormLabel className="mb-0 cursor-pointer">
                      Restricted access
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      Only listed users (plus admins and the creator) can see
                      this page. Manage the list from the page detail.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

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
            form="docs-page-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : null}
            {isEditing ? "Save changes" : "Create page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
