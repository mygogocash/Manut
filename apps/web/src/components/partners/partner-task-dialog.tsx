"use client";

import { Check, Loader2, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PARTNER_PRIORITIES } from "@/components/partners/partner-task-meta";
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
import { ApiError } from "@/lib/api-client";
import { stripHtmlToText } from "@/lib/utils";
import { type AssignableUser } from "@/services/directory.service";
import {
  addPartnerTaskResource,
  createPartnerTask,
  type CreatePartnerTaskInput,
  type PartnerColumn,
  type PartnerTask,
  type PartnerTaskResource,
  removePartnerTaskResource,
  updatePartnerTask,
  type UpdatePartnerTaskInput,
} from "@/services/partner-workspace.service";
import { uploadFile } from "@/services/upload.service";

// Only http(s) attachment URLs are rendered as live links — guards against
// a stored `javascript:`/`data:` URL becoming clickable (defence in depth;
// the API also rejects non-http(s) on write).
function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  columns: PartnerColumn[];
  users: AssignableUser[];
  /** Existing task to edit; null = create mode. */
  task: PartnerTask | null;
  /** Default column key for new tasks (e.g. clicked the "+ Add task" inside a column). */
  defaultColumnKey?: string;
  onSaved: (task: PartnerTask) => void;
}

export function PartnerTaskDialog({
  open,
  onOpenChange,
  partnerId,
  columns,
  users,
  task,
  defaultColumnKey,
  onSaved,
}: Props) {
  const isEdit = !!task;
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnKey, setColumnKey] = useState(defaultColumnKey ?? "todo");
  const [priority, setPriority] = useState("medium");
  const [ownerId, setOwnerId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [resources, setResources] = useState<PartnerTaskResource[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      // Column key is stored as the task `status` today (matches the
      // Project board pattern). When a dedicated `columnKey` field is
      // added on the schema this remap is one line.
      setColumnKey(task.status || defaultColumnKey || "todo");
      setPriority(task.priority);
      setOwnerId(task.ownerId ?? "");
      setAssigneeIds(task.assignees?.map((a) => a.userId) ?? []);
      setStartDate(task.startDate?.slice(0, 10) ?? "");
      setEndDate(task.endDate?.slice(0, 10) ?? "");
      setResources(task.resources ?? []);
    } else {
      setTitle("");
      setDescription("");
      setColumnKey(defaultColumnKey ?? "todo");
      setPriority("medium");
      setOwnerId("");
      setAssigneeIds([]);
      setStartDate("");
      setEndDate("");
      setResources([]);
    }
  }, [open, task, defaultColumnKey]);

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      // Quill emits "<p><br></p>" for an empty editor; persist undefined
      // (not that markup) when there's no real text so the board preview
      // and RichTextViewer treat it as blank.
      const trimmedDescription = description.trim();
      const hasDescription = stripHtmlToText(trimmedDescription).length > 0;
      const payload: CreatePartnerTaskInput | UpdatePartnerTaskInput = {
        title: title.trim(),
        description: hasDescription ? trimmedDescription : undefined,
        status: columnKey,
        priority,
        ownerId: ownerId || undefined,
        assigneeIds,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const res = task
        ? await updatePartnerTask(partnerId, task.id, payload)
        : await createPartnerTask(partnerId, payload as CreatePartnerTaskInput);
      toast.success(task ? "Task updated" : "Task created");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save task";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Attachments are added to an existing task, so uploading is only
  // available in edit mode. Each file is uploaded to storage, then
  // registered as a task resource.
  async function uploadFiles(files: FileList | File[]) {
    if (!task) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        const uploaded = await uploadFile(file, { purpose: "partner-task" });
        const res = await addPartnerTaskResource(partnerId, task.id, {
          kind: "file",
          label: file.name,
          url: uploaded.url,
        });
        setResources((prev) => [...prev, res.data]);
      }
      toast.success(list.length > 1 ? "Attachments added" : "Attachment added");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function removeResource(id: string) {
    if (!task) return;
    const previous = resources;
    setResources((r) => r.filter((x) => x.id !== id));
    try {
      await removePartnerTaskResource(partnerId, task.id, id);
    } catch {
      setResources(previous);
      toast.error("Failed to remove attachment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:min-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update task details for this partner workspace."
              : "Create a new task for this partner workspace."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="partner-task-title">Title *</Label>
            <Input
              id="partner-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="partner-task-description">Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Optional notes for the task"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Column</Label>
              <Select value={columnKey} onValueChange={setColumnKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTNER_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ background: p.color }}
                        />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Owner</Label>
            <Select
              value={ownerId || "__none__"}
              onValueChange={(v) => setOwnerId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Unassigned —</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Assignees</Label>
            <div
              className={`
                border-border max-h-36 overflow-y-auto rounded-md border p-1
              `}
            >
              {users.length === 0 ? (
                <p className="text-muted-foreground px-2 py-1.5 text-xs">
                  No users available
                </p>
              ) : (
                users.map((u) => {
                  const checked = assigneeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setAssigneeIds((prev) =>
                          prev.includes(u.id)
                            ? prev.filter((id) => id !== u.id)
                            : [...prev, u.id],
                        )
                      }
                      className={`
                        hover:bg-accent
                        flex w-full items-center gap-2 rounded px-2 py-1.5
                        text-left text-xs
                      `}
                    >
                      <span
                        className={`
                          flex size-3.5 items-center justify-center rounded-sm
                          border
                          ${
                            checked
                              ? `
                                bg-primary border-primary
                                text-primary-foreground
                              `
                              : "border-border"
                          }
                        `}
                      >
                        {checked ? <Check className="size-2.5" /> : null}
                      </span>
                      {u.name}
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-muted-foreground text-[11px]">
              Assign this task to one or more people.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="partner-task-start">Start date</Label>
              <FormDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="partner-task-end">End date</Label>
              <FormDatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Attachments</Label>
            {isEdit ? (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files?.length) {
                      void uploadFiles(e.dataTransfer.files);
                    }
                  }}
                  className={`
                    border-border text-muted-foreground flex cursor-pointer
                    flex-col items-center gap-1 rounded-md border border-dashed
                    p-4 text-center text-xs
                    ${dragOver ? "border-primary bg-accent/30" : ""}
                  `}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UploadCloud className="size-4" />
                  )}
                  <span>
                    Drag &amp; drop images or documents here, or click to upload
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      void uploadFiles(e.target.files);
                    }
                    e.target.value = "";
                  }}
                />
                {resources.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {resources.map((r) => (
                      <li
                        key={r.id}
                        className={`
                          border-border flex items-center justify-between gap-2
                          rounded border px-2 py-1 text-xs
                        `}
                      >
                        {isHttpUrl(r.url) ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                              text-primary flex min-w-0 items-center gap-1.5
                              hover:underline
                            `}
                          >
                            <Paperclip className="size-3 shrink-0" />
                            <span className="truncate">{r.label}</span>
                          </a>
                        ) : (
                          <span
                            className={`
                              text-muted-foreground flex min-w-0 items-center
                              gap-1.5
                            `}
                          >
                            <Paperclip className="size-3 shrink-0" />
                            <span className="truncate">{r.label}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Remove attachment"
                          onClick={() => void removeResource(r.id)}
                          className={`
                            text-muted-foreground shrink-0
                            hover:text-destructive
                          `}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground text-[11px]">
                Save the task first to attach files.
              </p>
            )}
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
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
