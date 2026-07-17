"use client";

import { GripVertical, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EditablePart {
  name: string;
  tasks: string[];
}

/**
 * Editor for the offboarding parts → tasks structure. Used by both the
 * create-run dialog (seeded from the template, tweakable per run) and the
 * Manage-template dialog. Parts and tasks are plain ordered arrays; order
 * here becomes the order on the saved run / template.
 */
export function PartsEditor({
  parts,
  onChange,
}: {
  parts: EditablePart[];
  onChange: (parts: EditablePart[]) => void;
}) {
  function setPart(i: number, next: EditablePart) {
    onChange(parts.map((p, idx) => (idx === i ? next : p)));
  }
  function removePart(i: number) {
    onChange(parts.filter((_, idx) => idx !== i));
  }
  function addPart() {
    onChange([...parts, { name: "", tasks: [""] }]);
  }

  return (
    <div className="flex flex-col gap-4">
      {parts.map((part, pi) => (
        <div
          key={pi}
          className="border-border flex flex-col gap-2 rounded-lg border p-3"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="text-muted-foreground/50 size-3.5 shrink-0" />
            <Input
              value={part.name}
              onChange={(e) => setPart(pi, { ...part, name: e.target.value })}
              placeholder="Part name (e.g. Company Assets)"
              className="h-8 flex-1 text-xs font-medium"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label="Delete part"
              onClick={() => removePart(pi)}
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="flex flex-col gap-1.5 pl-5">
            {part.tasks.map((task, ti) => (
              <div key={ti} className="flex items-center gap-2">
                <Input
                  value={task}
                  onChange={(e) =>
                    setPart(pi, {
                      ...part,
                      tasks: part.tasks.map((t, idx) =>
                        idx === ti ? e.target.value : t,
                      ),
                    })
                  }
                  placeholder="Task (e.g. Laptop)"
                  className="h-7 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove task"
                  onClick={() =>
                    setPart(pi, {
                      ...part,
                      tasks: part.tasks.filter((_, idx) => idx !== ti),
                    })
                  }
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground w-fit"
              onClick={() =>
                setPart(pi, { ...part, tasks: [...part.tasks, ""] })
              }
            >
              <Plus className="mr-1 size-3" />
              Add task
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={addPart}
      >
        <Plus className="mr-1.5 size-3.5" />
        Add part
      </Button>
    </div>
  );
}

/**
 * Drop empty parts/tasks and trim. Shared by the dialogs before save so a
 * blank trailing row never persists.
 */
export function cleanParts(parts: EditablePart[]): EditablePart[] {
  return parts
    .map((p) => ({
      name: p.name.trim(),
      tasks: p.tasks.map((t) => t.trim()).filter(Boolean),
    }))
    .filter((p) => p.name && p.tasks.length > 0);
}
