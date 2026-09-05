"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  createFundraisingEntity,
  deleteFundraisingEntity,
  type FundraisingEntity,
  listFundraisingEntities,
  reorderFundraisingEntities,
  updateFundraisingEntity,
} from "@/services/fundraising-entity.service";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

export function FundraisingEntitiesManagerDialog({
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [entities, setEntities] = useState<FundraisingEntity[]>([]);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await listFundraisingEntities();
      setEntities(res.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function notify() {
    void load();
    onChanged();
  }

  async function add() {
    if (!newLabel.trim()) return;
    try {
      setBusy(true);
      await createFundraisingEntity({ label: newLabel.trim() });
      setNewLabel("");
      toast.success("Entity added");
      notify();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to add entity",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(key: string) {
    if (!editLabel.trim()) {
      setEditingKey(null);
      return;
    }
    try {
      setBusy(true);
      await updateFundraisingEntity(key, { label: editLabel.trim() });
      setEditingKey(null);
      notify();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to rename entity",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: FundraisingEntity) {
    if (
      !window.confirm(
        `Delete "${e.label}"? Investors on it move to The Binary Holdings (or the first remaining entity).`,
      )
    ) {
      return;
    }
    try {
      setBusy(true);
      await deleteFundraisingEntity(e.key);
      toast.success("Entity deleted");
      notify();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete entity",
      );
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= entities.length) return;
    const next = [...entities];
    const [m] = next.splice(index, 1);
    next.splice(target, 0, m);
    setEntities(next);
    try {
      setBusy(true);
      await reorderFundraisingEntities(next.map((t) => t.key));
      onChanged();
    } catch (err) {
      void load();
      toast.error(
        err instanceof ApiError ? err.message : "Failed to reorder entities",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage fundraising entities</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          {entities.map((t, i) => (
            <div
              key={t.key}
              className={`
                border-border flex items-center gap-2 rounded-md border px-2
                py-1.5
              `}
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0 || busy}
                  onClick={() => void move(i, -1)}
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                    disabled:opacity-30
                  `}
                >
                  <ArrowUp className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === entities.length - 1 || busy}
                  onClick={() => void move(i, 1)}
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                    disabled:opacity-30
                  `}
                >
                  <ArrowDown className="size-3" />
                </button>
              </div>
              {editingKey === t.key ? (
                <>
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRename(t.key);
                      if (e.key === "Escape") setEditingKey(null);
                    }}
                    autoFocus
                    className="h-7 flex-1 text-sm"
                  />
                  <button
                    type="button"
                    aria-label="Save"
                    className="text-success p-0.5"
                    onClick={() => void saveRename(t.key)}
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel"
                    className="text-muted-foreground p-0.5"
                    onClick={() => setEditingKey(null)}
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{t.label}</span>
                  <button
                    type="button"
                    aria-label={`Rename ${t.label}`}
                    className={`
                      text-muted-foreground p-0.5
                      hover:text-foreground
                    `}
                    onClick={() => {
                      setEditingKey(t.key);
                      setEditLabel(t.label);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.label}`}
                    className={`
                      text-muted-foreground p-0.5
                      hover:text-destructive
                    `}
                    onClick={() => void remove(t)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            placeholder="New entity (e.g. The Binary Labs)"
            className="h-8 flex-1 text-sm"
          />
          <Button
            size="sm"
            onClick={() => void add()}
            disabled={busy || !newLabel.trim()}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
