"use client";

import {
  Check,
  Loader2,
  Paperclip,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import {
  normalizeProjectTaskPriority,
  projectTaskPriorityLabel,
} from "@/components/projects/task-priority";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  createTask,
  type GeneratedTask,
  generateTasksWithAI,
  type ProjectColumn,
  type Task,
} from "@/services/project.service";

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-destructive/12 text-destructive",
  P1: "bg-info/10 text-info",
  P2: "bg-muted text-muted-foreground",
};

export function AIGenerateTasksDialog({
  open,
  onOpenChange,
  projectId,
  projectDescription,
  columns,
  onTasksCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectDescription: string | null;
  columns: ProjectColumn[];
  onTasksCreated: (tasks: Task[]) => void;
}) {
  const [description, setDescription] = useState(projectDescription ?? "");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    new Set(),
  );
  const [step, setStep] = useState<"input" | "review">("input");
  const [files, setFiles] = useState<
    { name: string; mimeType: string; dataBase64: string }[]
  >([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setDescription(projectDescription ?? "");
    setAdditionalContext("");
    setGeneratedTasks([]);
    setSelectedIndexes(new Set());
    setStep("input");
    setFiles([]);
    setDragOver(false);
    setGenerating(false);
    setSaving(false);
  }, [projectDescription]);

  // Read dropped/picked files into base64 for the AI endpoint. Capped at
  // 8 files to match the server-side limit.
  async function addFiles(list: FileList | File[]) {
    const encoded = await Promise.all(
      Array.from(list).map(
        (f) =>
          new Promise<{ name: string; mimeType: string; dataBase64: string }>(
            (resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const r = String(reader.result);
                const comma = r.indexOf(",");
                resolve({
                  name: f.name,
                  mimeType: f.type || "application/octet-stream",
                  dataBase64: comma >= 0 ? r.slice(comma + 1) : r,
                });
              };
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(f);
            },
          ),
      ),
    );
    setFiles((prev) => [...prev, ...encoded].slice(0, 8));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleGenerate() {
    if (!description.trim()) {
      toast.error("Please enter a project description");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateTasksWithAI(projectId, {
        description: description.trim(),
        additionalContext: additionalContext.trim() || undefined,
        files: files.length > 0 ? files : undefined,
      });
      const tasks = result.data.tasks;
      setGeneratedTasks(tasks);
      setSelectedIndexes(new Set(tasks.map((_, i) => i)));
      setStep("review");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to generate tasks";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  function toggleTask(index: number) {
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIndexes.size === generatedTasks.length) {
      setSelectedIndexes(new Set());
    } else {
      setSelectedIndexes(new Set(generatedTasks.map((_, i) => i)));
    }
  }

  async function handleSaveSelected() {
    const tasksToCreate = generatedTasks.filter((_, i) =>
      selectedIndexes.has(i),
    );
    if (tasksToCreate.length === 0) {
      toast.error("Please select at least one task");
      return;
    }

    setSaving(true);
    try {
      const created: Task[] = [];
      for (const task of tasksToCreate) {
        const result = await createTask(projectId, {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
        });
        created.push(result.data);
      }
      onTasksCreated(created);
      handleOpenChange(false);
      toast.success(`${created.length} tasks created successfully`);
    } catch {
      toast.error("Failed to create some tasks");
    } finally {
      setSaving(false);
    }
  }

  function getColumnLabel(key: string): string {
    return columns.find((c) => c.key === key)?.label ?? key;
  }

  function getColumnColor(key: string): string {
    return columns.find((c) => c.key === key)?.color ?? "bg-zinc-500";
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`
          flex max-h-[85vh] flex-col gap-0 p-0
          md:max-w-2xl
        `}
      >
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div
              className={`
                flex size-7 items-center justify-center rounded-lg bg-violet-100
                dark:bg-violet-900/50
              `}
            >
              <Sparkles
                className={`
                  size-4 text-violet-600
                  dark:text-violet-400
                `}
              />
            </div>
            AI Generate Tasks
          </DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Describe your project and let AI suggest tasks for you."
              : `${generatedTasks.length} tasks generated. Select the ones you want to add.`}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`
            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border
            flex-1 overflow-y-auto px-5
            hover:scrollbar-thumb-muted-foreground/30
          `}
        >
          {step === "input" ? (
            <div className="flex flex-col gap-4 pb-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium" htmlFor="ai-description">
                  Project Description *
                </Label>
                <Textarea
                  id="ai-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this project is about, its goals, scope, technology stack, etc."
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium" htmlFor="ai-context">
                  Additional Context{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="ai-context"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Any specific requirements, deadlines, team size, technical constraints..."
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">
                  Attachments{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
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
                      void addFiles(e.dataTransfer.files);
                    }
                  }}
                  className={`
                    border-border text-muted-foreground flex cursor-pointer
                    flex-col items-center gap-1 rounded-md border border-dashed
                    p-4 text-center text-xs
                    ${dragOver ? "border-primary bg-accent/30" : ""}
                  `}
                >
                  <UploadCloud className="size-4" />
                  <span>
                    Drop images, PDF, Word, Excel, PowerPoint or text files
                    here, or click to upload
                  </span>
                  <span className="text-[10px]">
                    The AI reads them to suggest tasks · up to 8 files
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) void addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                {files.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className={`
                          border-border flex items-center justify-between gap-2
                          rounded border px-2 py-1 text-xs
                        `}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Paperclip className="size-3 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <button
                          type="button"
                          aria-label="Remove file"
                          onClick={() => removeFile(i)}
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
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-2">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="link"
                  onClick={toggleAll}
                  className={`
                    text-muted-foreground h-auto p-0 text-xs
                    hover:text-foreground
                  `}
                >
                  {selectedIndexes.size === generatedTasks.length
                    ? "Deselect all"
                    : "Select all"}
                </Button>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {selectedIndexes.size} / {generatedTasks.length} selected
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {generatedTasks.map((task, index) => (
                  <div
                    key={index}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleTask(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleTask(index);
                      }
                    }}
                    className={`
                      flex cursor-pointer items-start gap-3 rounded-lg border
                      p-3 text-left transition-all
                      ${
                        selectedIndexes.has(index)
                          ? `
                            border-violet-200 bg-violet-50/50
                            dark:border-violet-800 dark:bg-violet-950/30
                          `
                          : `
                            border-border bg-muted/20 opacity-50
                            hover:opacity-70
                          `
                      }
                    `}
                  >
                    <Checkbox
                      checked={selectedIndexes.has(index)}
                      onCheckedChange={() => toggleTask(index)}
                      className="mt-0.5"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="text-sm leading-tight font-medium">
                        {task.title}
                      </p>
                      {task.description && (
                        <p
                          className={`
                            text-muted-foreground line-clamp-2 text-xs
                            leading-relaxed
                          `}
                        >
                          {task.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className={`
                            text-[10px]
                            ${PRIORITY_COLORS[normalizeProjectTaskPriority(task.priority)] ?? PRIORITY_COLORS.P1}
                          `}
                        >
                          {projectTaskPriorityLabel(task.priority)}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <div
                            className={`
                              size-1.5 rounded-full
                              ${getColumnColor(task.status)}
                            `}
                          />
                          <span className="text-muted-foreground text-[10px]">
                            {getColumnLabel(task.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter
          className={`
            gap-2 border-t px-5 py-4
            sm:gap-0
          `}
        >
          {step === "review" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("input")}
              disabled={saving}
              className="mr-auto"
            >
              <X className="mr-1 size-3.5" />
              Back
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          {step === "input" ? (
            <Button
              onClick={handleGenerate}
              disabled={generating || !description.trim()}
              className={`
                min-w-36 bg-violet-600
                hover:bg-violet-700
              `}
            >
              {generating ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-3.5" />
              )}
              {generating ? "Generating..." : "Generate Tasks"}
            </Button>
          ) : (
            <Button
              onClick={handleSaveSelected}
              disabled={saving || selectedIndexes.size === 0}
              className="min-w-36"
            >
              {saving ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <Check className="mr-2 size-3.5" />
              )}
              {saving
                ? "Creating..."
                : `Add ${selectedIndexes.size} Task${selectedIndexes.size !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
