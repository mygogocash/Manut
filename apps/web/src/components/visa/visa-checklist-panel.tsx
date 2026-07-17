"use client";

import { ListChecks, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/lib/api-client";
import {
  getVisaChecklist,
  toggleVisaChecklistItem,
  type VisaChecklistItem,
} from "@/services/visa-checklist.service";

export function VisaChecklistPanel({ visaId }: { visaId: string }) {
  const [items, setItems] = useState<VisaChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVisaChecklist(visaId)
      .then((res) => {
        if (!cancelled) setItems(res.data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visaId]);

  const { documents, steps, done, total } = useMemo(() => {
    const documents = items.filter((i) => i.category === "document");
    const steps = items.filter((i) => i.category === "step");
    const done = items.filter((i) => i.completed).length;
    return { documents, steps, done, total: items.length };
  }, [items]);

  async function toggle(item: VisaChecklistItem) {
    const next = !item.completed;
    setBusyId(item.id);
    // Optimistic.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed: next } : i)),
    );
    try {
      await toggleVisaChecklistItem(visaId, item.id, next);
    } catch (err) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, completed: item.completed } : i,
        ),
      );
      toast.error(err instanceof ApiError ? err.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  if (!loading && total === 0) return null;

  const renderGroup = (label: string, group: VisaChecklistItem[]) =>
    group.length === 0 ? null : (
      <div className="flex flex-col gap-1.5">
        <div
          className={`
            text-muted-foreground text-[10px] font-semibold tracking-wide
            uppercase
          `}
        >
          {label}
        </div>
        {group.map((item) => (
          <label
            key={item.id}
            htmlFor={`chk-${item.id}`}
            className="flex cursor-pointer items-center gap-2.5"
          >
            <Checkbox
              id={`chk-${item.id}`}
              checked={item.completed}
              disabled={busyId === item.id}
              onCheckedChange={() => toggle(item)}
            />
            <span
              className={`
                flex-1 text-sm
                ${
                  item.completed
                    ? "text-muted-foreground line-through"
                    : `text-foreground`
                }
              `}
            >
              {item.label}
            </span>
            {item.optional ? (
              <Badge variant="grey" className="text-[10px]">
                Optional
              </Badge>
            ) : null}
          </label>
        ))}
      </div>
    );

  return (
    <div className="border-border/60 rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div
          className={`
            text-foreground flex items-center gap-2 text-sm font-semibold
          `}
        >
          <ListChecks className="size-4" />
          Checklist
        </div>
        {!loading && total > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {done} of {total} complete
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="flex h-12 items-center justify-center">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {renderGroup("Documents", documents)}
          {renderGroup("Steps", steps)}
        </div>
      )}
    </div>
  );
}
