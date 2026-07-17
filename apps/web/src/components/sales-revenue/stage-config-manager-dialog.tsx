"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { ApiError } from "@/lib/api-client";
import {
  bulkUpdateOpportunityStageConfigs,
  listOpportunityStageConfigs,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
  type OpportunityStageConfig,
} from "@/services/revenue-opportunity.service";

interface DraftRow {
  key: OpportunityStage;
  label: string;
  probability: string; // text-controlled to allow "" while editing
  sortOrder: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires after a successful save so callers can refresh anything that
   *  reads stage configs (kanban headers, opp form). */
  onSaved?: () => void;
}

function fromConfig(c: OpportunityStageConfig): DraftRow {
  return {
    key: c.key,
    label: c.label,
    probability: String(c.probability),
    sortOrder: String(c.sortOrder),
  };
}

export function StageConfigManagerDialog({
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listOpportunityStageConfigs()
      .then((res) => {
        if (cancelled) return;
        // Server already orders by sortOrder ASC. Map straight to drafts
        // so the dialog reflects the canonical ordering.
        setDrafts(res.data.map(fromConfig));
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError ? err.message : "Failed to load stage config";
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const stagesPresent = useMemo(
    () => new Set(drafts.map((d) => d.key)),
    [drafts],
  );

  // Always-visible warning if the server payload is missing a stage
  // (shouldn't happen — the migration seeds all 5 — but the bulk-update
  // endpoint requires every key, so surface the gap explicitly).
  const missingStages = OPPORTUNITY_STAGES.filter((s) => !stagesPresent.has(s));

  function updateDraft(key: OpportunityStage, patch: Partial<DraftRow>) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    );
  }

  async function handleSave() {
    // Coerce + validate before sending. Empty probability or sortOrder
    // is treated as 0; out-of-range values bail with a toast.
    const payload: Array<{
      key: OpportunityStage;
      label: string;
      probability: number;
      sortOrder: number;
    }> = [];

    for (const d of drafts) {
      const probability = Number(d.probability);
      const sortOrder = Number(d.sortOrder);
      if (!d.label.trim()) {
        toast.error(`Label is required for ${d.key}`);
        return;
      }
      if (
        !Number.isFinite(probability) ||
        probability < 0 ||
        probability > 100
      ) {
        toast.error(`Probability for ${d.label} must be 0–100`);
        return;
      }
      if (!Number.isFinite(sortOrder) || sortOrder < 0) {
        toast.error(`Sort order for ${d.label} must be a non-negative number`);
        return;
      }
      payload.push({
        key: d.key,
        label: d.label.trim(),
        probability: Math.round(probability),
        sortOrder: Math.round(sortOrder),
      });
    }

    try {
      setSaving(true);
      await bulkUpdateOpportunityStageConfigs({ configs: payload });
      toast.success("Stage configuration saved");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save stage config";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Manage stages</DialogTitle>
          <DialogDescription>
            Edit the label, default auto-fill probability and column order for
            each pipeline stage. New opportunities snap to the probability set
            here unless the rep enters one manually.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-muted-foreground py-12 text-center text-xs">
            <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {missingStages.length > 0 ? (
              <p
                className={`
                  border-destructive/40 bg-destructive/5 text-destructive
                  rounded-md border p-2 text-[11px]
                `}
              >
                Missing stage rows: {missingStages.join(", ")}. Re-run the seed
                migration before saving.
              </p>
            ) : null}
            <div
              className={`
                text-muted-foreground grid grid-cols-[1fr_120px_120px]
                items-center gap-2 px-2 text-[10px] font-bold tracking-widest
                uppercase
              `}
            >
              <span>Label</span>
              <span className="text-right">Probability (%)</span>
              <span className="text-right">Sort order</span>
            </div>
            {drafts.map((d) => (
              <div
                key={d.key}
                className={`
                  border-border bg-surface grid grid-cols-[1fr_120px_120px]
                  items-center gap-2 rounded-md border px-2 py-2
                `}
              >
                <div className="flex flex-col gap-0.5">
                  <Input
                    value={d.label}
                    onChange={(e) =>
                      updateDraft(d.key, { label: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                  <span
                    className={`
                      text-muted-foreground text-[10px] tracking-wide uppercase
                    `}
                  >
                    {d.key}
                  </span>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={d.probability}
                  onChange={(e) =>
                    updateDraft(d.key, { probability: e.target.value })
                  }
                  className="h-8 text-right text-xs tabular-nums"
                />
                <Input
                  type="number"
                  min={0}
                  value={d.sortOrder}
                  onChange={(e) =>
                    updateDraft(d.key, { sortOrder: e.target.value })
                  }
                  className="h-8 text-right text-xs tabular-nums"
                />
              </div>
            ))}
            <p className="text-muted-foreground text-[11px]">
              Stage codes ({OPPORTUNITY_STAGES.join(", ")}) are fixed — renaming
              a label here does not change the underlying value stored on each
              opportunity row, so reporting that filters by stage code keeps
              working unchanged.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || drafts.length === 0}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
