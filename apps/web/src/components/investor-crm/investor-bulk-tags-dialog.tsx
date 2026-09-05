"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CodeMultiSelect } from "@/components/shared/code-multi-select";
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
import { useInvestorTags } from "@/hooks/use-investor-tags";
import type {
  InvestorBulkResult,
  InvestorBulkSelection,
} from "@/services/investor.service";

interface InvestorBulkTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many investors the action will touch, for the copy. */
  count: number;
  /** The resolved selection — ids, or allMatching plus the board's filter. */
  selection: InvestorBulkSelection;
  submit: (
    payload: InvestorBulkSelection & {
      mode: "add" | "replace";
      codes: string[];
    },
  ) => Promise<{ data: InvestorBulkResult }>;
  /** Reload the board and clear the selection. */
  onDone: () => void;
}

/**
 * Add or replace tags across a bulk selection.
 *
 * Separate from `BulkFieldDialog` because this is a decision, not a
 * confirmation: `add` keeps what each investor already carries, `replace`
 * overwrites every one of them. Presenting that as a plain "set this value"
 * would make a destructive option look like the routine one.
 *
 * Kept investor-specific rather than generalised from
 * `BulkBusinessUnitsDialog`: that component reads the business-unit catalog
 * internally. If a third bulk code-set dialog ever appears, extract the shared
 * shell then rather than growing a third copy — the same argument
 * `investor-tags-manager-dialog.tsx` makes about the manager dialogs.
 */
export function InvestorBulkTagsDialog({
  open,
  onOpenChange,
  count,
  selection,
  submit,
  onDone,
}: InvestorBulkTagsDialogProps) {
  const { tags } = useInvestorTags();
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [codes, setCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset on reopen so a previous run's picks never carry into the next one.
  useEffect(() => {
    if (open) {
      setMode("add");
      setCodes([]);
    }
  }, [open]);

  const label = count === 1 ? "investor" : "investors";
  // `replace` with nothing selected is meaningful — it clears every tag — so
  // only `add` needs a code to act on.
  const canSubmit = mode === "replace" || codes.length > 0;

  async function onSubmit() {
    setSaving(true);
    try {
      const res = await submit({ ...selection, mode, codes });
      const { updated, skipped, failed } = res.data;

      const parts = [`${updated} updated`];
      if (skipped > 0) parts.push(`${skipped} unchanged`);
      if (failed.length > 0) parts.push(`${failed.length} failed`);

      if (failed.length > 0) {
        toast.error(`Tags: ${parts.join(", ")}`, {
          description: failed[0]?.reason,
        });
      } else {
        toast.success(`Tags: ${parts.join(", ")}`);
      }
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set tags");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set tags</DialogTitle>
          <DialogDescription>
            {count} {label} selected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>How</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="investor-bulk-tag-mode"
                  className="mt-1"
                  checked={mode === "add"}
                  onChange={() => setMode("add")}
                />
                <span>
                  Add
                  <span className="text-muted-foreground block text-xs">
                    Keeps the tags each investor already has.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="investor-bulk-tag-mode"
                  className="mt-1"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                />
                <span>
                  Replace
                  <span className="text-muted-foreground block text-xs">
                    Overwrites existing tags on every selected investor.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <CodeMultiSelect
              options={tags.map((t) => ({ code: t.code, label: t.label }))}
              value={codes}
              onChange={setCodes}
              placeholder="Select tags"
              emptyLabel="No tags defined yet — add some from Manage tags."
            />
          </div>

          {mode === "replace" && codes.length === 0 ? (
            <p className="text-destructive text-xs">
              This will clear every tag on {count} {label}.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || saving}
            variant={mode === "replace" ? "destructive" : "default"}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "replace" ? "Replace tags" : "Add tags"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
