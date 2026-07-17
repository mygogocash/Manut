"use client";

import { CheckSquare, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
  OnboardingRun,
  OnboardingTaskInput,
} from "@/services/hrms.service";

interface Props {
  run: OnboardingRun | null;
  updatingTasks: Set<string>;
  canManage: boolean;
  onToggle: (runId: string, taskKey: string, done: boolean) => void;
  onSaveTasks?: (runId: string, tasks: OnboardingTaskInput[]) => Promise<void>;
}

export function ExpandedTaskList({
  run,
  updatingTasks,
  canManage,
  onToggle,
  onSaveTasks,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [newLabels, setNewLabels] = useState<Record<string, string>>({});
  const [newPartName, setNewPartName] = useState("");
  const [extraParts, setExtraParts] = useState<string[]>([]);
  const [editingPart, setEditingPart] = useState<string | null>(null);
  const [draftPart, setDraftPart] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  useEffect(() => {
    setEditingKey(null);
    setDraftLabel("");
    setNewLabels({});
    setNewPartName("");
    setExtraParts([]);
    setEditingPart(null);
  }, [run?.id]);

  const tasks = useMemo(() => run?.tasks ?? [], [run]);

  const partOrder = useMemo(() => {
    const order: string[] = [];
    for (const t of tasks) if (!order.includes(t.part)) order.push(t.part);
    for (const p of extraParts) if (!order.includes(p)) order.push(p);
    return order;
  }, [tasks, extraParts]);

  if (!run) return null;

  function toInputs(): OnboardingTaskInput[] {
    return (run?.tasks ?? []).map((t) => ({
      key: t.key,
      label: t.label,
      part: t.part,
      done: t.done,
      doneAt: t.doneAt,
    }));
  }

  async function commit(next: OnboardingTaskInput[]) {
    if (!onSaveTasks || !run) return;
    setSavingBulk(true);
    try {
      await onSaveTasks(run.id, next);
    } finally {
      setSavingBulk(false);
    }
  }

  async function handleRename(key: string) {
    const trimmed = draftLabel.trim();
    setEditingKey(null);
    if (!trimmed) return;
    const original = tasks.find((t) => t.key === key);
    if (!original || original.label === trimmed) return;
    await commit(
      toInputs().map((t) => (t.key === key ? { ...t, label: trimmed } : t)),
    );
  }

  async function handleDelete(key: string) {
    if (tasks.length <= 1) return;
    const label = tasks.find((t) => t.key === key)?.label;
    if (!confirm(`Delete task "${label}"?`)) return;
    await commit(toInputs().filter((t) => t.key !== key));
  }

  async function handleAddTask(part: string) {
    const trimmed = (newLabels[part] ?? "").trim();
    if (!trimmed) return;
    setNewLabels((p) => ({ ...p, [part]: "" }));
    setExtraParts((prev) => prev.filter((p) => p !== part));
    await commit([...toInputs(), { label: trimmed, part, done: false }]);
  }

  function handleAddPart() {
    const name = newPartName.trim();
    if (!name || partOrder.includes(name)) {
      setNewPartName("");
      return;
    }
    setExtraParts((prev) => [...prev, name]);
    setNewPartName("");
  }

  async function handleRenamePart(oldName: string) {
    const next = draftPart.trim();
    setEditingPart(null);
    if (!next || next === oldName) return;
    setExtraParts((prev) => prev.map((p) => (p === oldName ? next : p)));
    const affected = toInputs().filter((t) => t.part === oldName);
    if (affected.length === 0) return;
    await commit(
      toInputs().map((t) => (t.part === oldName ? { ...t, part: next } : t)),
    );
  }

  async function handleDeletePart(name: string) {
    const remaining = toInputs().filter((t) => t.part !== name);
    const inPart = tasks.filter((t) => t.part === name);
    if (inPart.length > 0) {
      if (!confirm(`Delete part "${name}" and its ${inPart.length} task(s)?`)) {
        return;
      }
      if (remaining.length === 0) {
        alert("A run must keep at least one task. Add another part first.");
        return;
      }
    }
    setExtraParts((prev) => prev.filter((p) => p !== name));
    if (inPart.length > 0) await commit(remaining);
  }

  const employeeName = run.employee?.name ?? run.employeeName;
  const editable = canManage && Boolean(onSaveTasks);

  return (
    <div
      className={`
        border-border bg-surface animate-in fade-in-0 slide-in-from-top-1 flex
        flex-col gap-4 rounded-lg border p-4 shadow-sm
      `}
    >
      <div className="mb-1 flex items-center gap-2">
        <CheckSquare className="text-muted-foreground size-4" />
        <h3 className="text-foreground text-sm font-medium">
          Onboarding tasks for {employeeName}
        </h3>
        {savingBulk ? (
          <Loader2 className="text-muted-foreground ml-2 size-3.5 animate-spin" />
        ) : null}
      </div>

      {partOrder.map((part) => {
        const partTasks = tasks.filter((t) => t.part === part);
        const isEditingPartName = editingPart === part;
        return (
          <div key={part} className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              {isEditingPartName ? (
                <Input
                  value={draftPart}
                  autoFocus
                  onChange={(e) => setDraftPart(e.target.value)}
                  onBlur={() => void handleRenamePart(part)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleRenamePart(part);
                    } else if (e.key === "Escape") {
                      setEditingPart(null);
                    }
                  }}
                  className="h-6 w-56 text-[11px] font-bold uppercase"
                  disabled={savingBulk}
                />
              ) : (
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  {part}
                </p>
              )}
              {editable && !isEditingPartName && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground size-5"
                    type="button"
                    aria-label={`Rename part ${part}`}
                    onClick={() => {
                      setEditingPart(part);
                      setDraftPart(part);
                    }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive size-5"
                    type="button"
                    aria-label={`Delete part ${part}`}
                    onClick={() => void handleDeletePart(part)}
                    disabled={savingBulk}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </>
              )}
            </div>

            {partTasks.map((task) => {
              const lockKey = `${run.id}:${task.key}`;
              const isUpdating = updatingTasks.has(lockKey);
              const isEditingThis = editingKey === task.key;
              return (
                <div
                  key={task.key}
                  className={`
                    border-border flex items-center gap-3 rounded-md border px-3
                    py-2.5 transition-colors
                    hover:bg-surface-secondary
                  `}
                >
                  {isUpdating ? (
                    <Loader2
                      className={`text-muted-foreground size-4 animate-spin`}
                    />
                  ) : (
                    <Checkbox
                      checked={task.done}
                      disabled={!canManage || isEditingThis}
                      onCheckedChange={(checked) =>
                        onToggle(run.id, task.key, checked === true)
                      }
                    />
                  )}

                  {isEditingThis ? (
                    <Input
                      value={draftLabel}
                      autoFocus
                      onChange={(e) => setDraftLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleRename(task.key);
                        } else if (e.key === "Escape") {
                          setEditingKey(null);
                        }
                      }}
                      onBlur={() => void handleRename(task.key)}
                      className="h-7 flex-1 text-xs"
                      disabled={savingBulk}
                    />
                  ) : (
                    <span
                      className={`
                        flex-1 text-xs
                        ${
                          task.done
                            ? "text-muted-foreground line-through"
                            : `text-foreground`
                        }
                      `}
                    >
                      {task.label}
                    </span>
                  )}

                  {task.doneAt && !isEditingThis && (
                    <span
                      className={`
                        text-muted-foreground text-[10px] tabular-nums
                      `}
                    >
                      {new Date(task.doneAt).toLocaleDateString()}
                    </span>
                  )}

                  {editable ? (
                    isEditingThis ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        type="button"
                        onClick={() => setEditingKey(null)}
                        aria-label="Cancel edit"
                      >
                        <X className="size-3.5" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          type="button"
                          onClick={() => {
                            setEditingKey(task.key);
                            setDraftLabel(task.label);
                          }}
                          disabled={savingBulk || isUpdating}
                          aria-label={`Rename ${task.label}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive size-7"
                          type="button"
                          onClick={() => void handleDelete(task.key)}
                          disabled={
                            savingBulk || isUpdating || tasks.length <= 1
                          }
                          aria-label={`Delete ${task.label}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )
                  ) : null}
                </div>
              );
            })}

            {partTasks.length === 0 && (
              <p className="text-muted-foreground py-1 text-center text-xs">
                No tasks in this part yet.
              </p>
            )}

            {editable && (
              <div
                className={`
                  border-border/60 flex items-center gap-2 rounded-md border
                  border-dashed px-3 py-2
                `}
              >
                <Plus className="text-muted-foreground size-3.5" />
                <Input
                  value={newLabels[part] ?? ""}
                  onChange={(e) =>
                    setNewLabels((p) => ({ ...p, [part]: e.target.value }))
                  }
                  placeholder="Add a task…"
                  className={`
                    h-7 flex-1 border-none p-0 shadow-none
                    focus-visible:ring-0
                  `}
                  disabled={savingBulk}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAddTask(part);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => void handleAddTask(part)}
                  disabled={savingBulk || !(newLabels[part] ?? "").trim()}
                  className="h-7 px-2.5 text-xs"
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {editable && (
        <div className="flex items-center gap-2">
          <Input
            value={newPartName}
            onChange={(e) => setNewPartName(e.target.value)}
            placeholder="New part name…"
            className="h-7 max-w-xs text-xs"
            disabled={savingBulk}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddPart();
              }
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={handleAddPart}
            disabled={!newPartName.trim()}
            className="h-7 px-2.5 text-xs"
          >
            <Plus className="mr-1 size-3.5" />
            Add part
          </Button>
        </div>
      )}
    </div>
  );
}
