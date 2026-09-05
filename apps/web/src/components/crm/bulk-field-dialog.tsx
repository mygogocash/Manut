"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RemoteUserPicker } from "@/components/crm/remote-user-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { BulkBusinessUnitsResult } from "@/services/crm-opportunity.service";

/** What the dialog is being opened to do. */
export type BulkFieldMode = "owner" | "archive" | "unarchive" | "lifecycle";

export interface BulkFieldPayload {
  ids?: string[];
  allMatching?: boolean;
  filter?: Record<string, string | boolean | undefined>;
  set: {
    ownerId?: string;
    archived?: boolean;
    /** Opportunity stage. */
    stage?: string;
    /** Lead status. */
    status?: string;
  };
}

interface BulkFieldDialogProps {
  /** Null while closed — the mode doubles as the open flag. */
  mode: BulkFieldMode | null;
  onClose: () => void;
  count: number;
  recordLabel: string;
  selection: Omit<BulkFieldPayload, "set">;
  /**
   * Selectable stage/status values with their labels, supplied by the caller
   * because the field name and the legal values both differ per record type —
   * `stage` for opportunities, `status` for leads, and accounts have neither.
   * Omit to hide the lifecycle mode.
   */
  lifecycle?: {
    field: "stage" | "status";
    label: string;
    options: Array<{ value: string; label: string }>;
  };
  submit: (
    payload: BulkFieldPayload,
  ) => Promise<{ data: BulkBusinessUnitsResult }>;
  onDone: () => void;
}

const COPY: Record<
  BulkFieldMode,
  { title: string; confirm: string; describe: (n: number, l: string) => string }
> = {
  owner: {
    title: "Reassign owner",
    confirm: "Reassign",
    describe: (n, l) => `${n} ${l} will move to the person you pick.`,
  },
  archive: {
    title: "Archive selection",
    confirm: "Archive",
    describe: (n, l) =>
      `${n} ${l} will move to the Archived view. Nothing is deleted — you can restore them from there.`,
  },
  unarchive: {
    title: "Restore selection",
    confirm: "Restore",
    describe: (n, l) => `${n} ${l} will move back to the Active view.`,
  },
  lifecycle: {
    title: "Change stage",
    confirm: "Move",
    describe: (n, l) => `${n} ${l} will move to the stage you pick.`,
  },
};

/**
 * Owner reassignment and archive/unarchive for a bulk selection.
 *
 * One dialog rather than three because the shape is the same — a confirmation
 * over a resolved selection — and only the owner mode adds a control. Business
 * units get their own dialog because add-vs-replace is a genuinely different
 * decision, not a confirmation.
 */
export function BulkFieldDialog({
  mode,
  onClose,
  count,
  recordLabel,
  selection,
  lifecycle,
  submit,
  onDone,
}: BulkFieldDialogProps) {
  const [ownerId, setOwnerId] = useState("");
  const [lifecycleValue, setLifecycleValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when reopened so a previous pick never carries into the next run.
  useEffect(() => {
    if (mode) {
      setOwnerId("");
      setLifecycleValue("");
    }
  }, [mode]);

  if (!mode) return null;
  const copy =
    mode === "lifecycle" && lifecycle?.field === "status"
      ? { ...COPY.lifecycle, title: "Change status" }
      : COPY[mode];
  const canSubmit =
    mode === "owner"
      ? ownerId !== ""
      : mode === "lifecycle"
        ? lifecycleValue !== ""
        : true;

  async function onSubmit() {
    if (!mode) return;
    setSaving(true);
    try {
      const res = await submit({
        ...selection,
        set:
          mode === "owner"
            ? { ownerId }
            : mode === "lifecycle"
              ? { [lifecycle!.field]: lifecycleValue }
              : { archived: mode === "archive" },
      });
      const { updated, skipped, failed } = res.data;

      // Report what happened rather than a flat "done" — a bulk write over N
      // rows can genuinely partially succeed.
      const parts = [`${updated} updated`];
      if (skipped > 0) parts.push(`${skipped} already set`);
      if (failed.length > 0) parts.push(`${failed.length} failed`);

      if (failed.length > 0) {
        toast.error(`${copy.title}: ${parts.join(", ")}`, {
          description: failed[0]?.reason,
        });
      } else {
        toast.success(`${copy.title}: ${parts.join(", ")}`);
      }
      onClose();
      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${copy.confirm.toLowerCase()}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.describe(count, recordLabel)}
          </DialogDescription>
        </DialogHeader>

        {mode === "lifecycle" && lifecycle && (
          <div className="space-y-2">
            <Label>{lifecycle.label}</Label>
            <div className="flex flex-col gap-2">
              {lifecycle.options.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="bulk-lifecycle"
                    checked={lifecycleValue === o.value}
                    onChange={() => setLifecycleValue(o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {mode === "owner" && (
          <div className="space-y-2">
            <Label>New owner</Label>
            <RemoteUserPicker value={ownerId} onValueChange={setOwnerId} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || saving}
            variant={mode === "archive" ? "destructive" : "default"}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
