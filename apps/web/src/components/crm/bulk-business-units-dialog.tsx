"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
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
import {
  useBusinessUnits,
  variantForBusinessUnitCode,
} from "@/hooks/use-business-units";
import type {
  BulkBusinessUnitsPayload,
  BulkBusinessUnitsResult,
} from "@/services/crm-opportunity.service";

type Mode = "add" | "replace";

interface BulkBusinessUnitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many records the action will touch, for the copy. */
  count: number;
  /** What the records are called, e.g. "deals" / "accounts" / "leads". */
  recordLabel: string;
  /** Everything except the `businessUnits` half — the dialog supplies that. */
  selection: Omit<BulkBusinessUnitsPayload, "businessUnits">;
  submit: (
    payload: BulkBusinessUnitsPayload,
  ) => Promise<{ data: BulkBusinessUnitsResult }>;
  /** Reload the list and clear the selection. */
  onDone: () => void;
}

export function BulkBusinessUnitsDialog({
  open,
  onOpenChange,
  count,
  recordLabel,
  selection,
  submit,
  onDone,
}: BulkBusinessUnitsDialogProps) {
  const { units } = useBusinessUnits();
  const [mode, setMode] = useState<Mode>("add");
  const [codes, setCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset on every open so a previous run's choices never leak into the next
  // one — a bulk action is the last place you want a stale form.
  useEffect(() => {
    if (open) {
      setMode("add");
      setCodes([]);
    }
  }, [open]);

  const toggle = (code: string) =>
    setCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const canSubmit = mode === "replace" || codes.length > 0;

  async function onSubmit() {
    setSaving(true);
    try {
      const res = await submit({
        ...selection,
        businessUnits: { mode, codes },
      });
      const { updated, skipped, failed } = res.data;

      // Report what actually happened. "Done" over a partial failure is how a
      // bulk action quietly loses rows.
      const parts = [`${updated} updated`];
      if (skipped > 0) parts.push(`${skipped} already set`);
      if (failed.length > 0) parts.push(`${failed.length} failed`);

      if (failed.length > 0) {
        toast.error(`Business units: ${parts.join(", ")}`, {
          description: failed[0]?.reason,
        });
      } else {
        toast.success(`Business units: ${parts.join(", ")}`);
      }
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign business units",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign business units</DialogTitle>
          <DialogDescription>
            {count} {recordLabel} selected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">How to apply</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="bulk-bu-mode"
                className="mt-1"
                checked={mode === "add"}
                onChange={() => setMode("add")}
              />
              <span>
                <span className="font-medium">Add</span> — keep existing units
                and add the ones below.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="bulk-bu-mode"
                className="mt-1"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              <span>
                <span className="font-medium">Replace</span> — the units below
                become the only ones.
              </span>
            </label>
          </fieldset>

          {mode === "replace" && (
            <p
              className={`
                border-destructive/40 bg-destructive/5 text-destructive
                rounded-md border p-2 text-xs
              `}
            >
              Replace removes any unit not selected below. On a deal that also
              deletes that unit&apos;s own stage, value and close date.
              Selecting nothing clears every unit.
            </p>
          )}

          <div className="space-y-2">
            <Label>Business units</Label>
            {units.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No business units configured yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {units.map((u) => (
                  <label
                    key={u.code}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={codes.includes(u.code)}
                      onCheckedChange={() => toggle(u.code)}
                    />
                    <Badge variant={variantForBusinessUnitCode(u.code)}>
                      {u.label}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "replace" ? "Replace units" : "Add units"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
