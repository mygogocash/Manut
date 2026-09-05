"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  configuredCount,
  draftsToTargets,
  orphanedTargets,
  type RecapTargetDraft,
  seedDrafts,
} from "@/components/marketing-analytics/recap-targets";
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
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  getRecapTargets,
  putRecapTargets,
  type RecapTarget,
} from "@/services/marketing-recap.service";

/**
 * The Daily Recap's per-telco targets: addressable MAU, target DAU, excluded.
 *
 * Until this existed the recap's own footnote told the reader to send a PUT to
 * /api/marketing-recap/targets by hand, so in practice the addressable-MAU and
 * target-DAU columns stayed empty and the "% of" columns beside them read as an
 * em dash on a dashboard people review every morning.
 *
 * A dialog rather than editable cells in the table. Not because an input could
 * not live in a cell — CustomizableTable puts its drag listeners on the row's
 * grip button, so body cells would tolerate one — but because the reader can
 * HIDE the very column that would hold the editor, and because what is being
 * edited is a three-field form per telco covering EVERY telco, including ones
 * the current Accounts filter has removed from the table entirely.
 */
export function RecapTargetsDialog({
  open,
  onOpenChange,
  canEdit,
  accounts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  /** Every telco from the dashboard payload, estate key already removed. */
  accounts: { key: string; label: string }[];
  onSaved: (targets: RecapTarget[]) => void;
}) {
  const [drafts, setDrafts] = useState<RecapTargetDraft[]>([]);
  const [orphans, setOrphans] = useState<RecapTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /**
   * The read failed, so what is on screen is NOT the stored state.
   *
   * This has to disarm Save. The PUT replaces the whole array, so saving a
   * dialog seeded blank by a failed GET would delete every stored figure and
   * every carried-over row in one click — and the read is reachably fragile:
   * GET /targets requires marketing:dashboard:view, which a reader who reached
   * this page through marketing:raw:view does not necessarily hold.
   */
  const [loadFailed, setLoadFailed] = useState(false);

  // Re-read on each open rather than trusting what the page fetched on mount:
  // this is one org-wide row, the PUT replaces all of it, and saving a stale
  // copy would silently revert another admin's edit.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    getRecapTargets()
      .then((res) => {
        if (cancelled) return;
        setDrafts(seedDrafts({ accounts, stored: res.data }));
        setOrphans(orphanedTargets(accounts, res.data));
      })
      .catch((err) => {
        if (cancelled) return;
        // Nothing configured yet is the normal first-run state and arrives as a
        // successful empty array, so an error here is a real failure. The rows
        // still render, so the admin can see what the editor would have shown,
        // but Save is disarmed: these blanks are this component's guess, not the
        // stored state, and writing them would delete the real thing.
        setDrafts(seedDrafts({ accounts, stored: [] }));
        setOrphans([]);
        setLoadFailed(true);
        toast.error(
          err instanceof ApiError ? err.message : "Failed to load targets",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, accounts]);

  const parsed = draftsToTargets(drafts, orphans);
  const errorCount = Object.keys(parsed.errors).length;

  const patch = (partnerId: string, next: Partial<RecapTargetDraft>) =>
    setDrafts((current) =>
      current.map((d) => (d.partnerId === partnerId ? { ...d, ...next } : d)),
    );

  const save = async () => {
    if (loadFailed) {
      toast.error("Close and reopen — the current targets could not be read");
      return;
    }
    if (!parsed.valid) {
      toast.error("Fix the highlighted figures first");
      return;
    }
    setSaving(true);
    try {
      const res = await putRecapTargets(parsed.targets);
      onSaved(res.data);
      const configured = configuredCount(drafts);
      toast.success(
        configured === 0
          ? "Targets cleared — the recap will show “—” again"
          : `Addressable MAU set for ${configured} telco${configured === 1 ? "" : "s"}`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save targets",
      );
    } finally {
      setSaving(false);
    }
  };

  const disabled = !canEdit || loading || saving || loadFailed;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Daily Recap targets</DialogTitle>
          <DialogDescription>
            Addressable MAU and target DAU per telco. These are the deck&apos;s
            figures, held here rather than derived: the addressable MAU
            management reviews does not match the host MAU the analytics API
            reports, so computing it would quietly disagree with the deck. Leave
            a field blank for &ldquo;not set&rdquo; — it shows as
            &ldquo;—&rdquo;. Excluded telcos are left out of the recap totals.
            {canEdit ? null : " You do not have permission to change these."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          <div
            className={`
              text-muted-foreground grid grid-cols-[1fr_9rem_8rem_5rem] gap-2
              px-1 text-[11px] tracking-wide uppercase
            `}
          >
            <span>Telco</span>
            <span className="text-right">Addressable MAU</span>
            <span className="text-right">Target DAU</span>
            <span className="text-center">Excluded</span>
          </div>

          {loading && drafts.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Loading…
            </p>
          ) : (
            drafts.map((d) => {
              const mauError = parsed.errors[`${d.partnerId}.addressableMau`];
              const dauError = parsed.errors[`${d.partnerId}.targetDau`];
              return (
                <div key={d.partnerId} className="space-y-1">
                  <div
                    className={`
                      grid grid-cols-[1fr_9rem_8rem_5rem] items-center gap-2
                      px-1
                    `}
                  >
                    <label
                      htmlFor={`addressable-${d.partnerId}`}
                      className="truncate text-sm font-medium"
                    >
                      {d.label}
                    </label>
                    <Input
                      id={`addressable-${d.partnerId}`}
                      value={d.addressableMau}
                      onChange={(e) =>
                        patch(d.partnerId, { addressableMau: e.target.value })
                      }
                      // Excluded telcos are left out of the totals, so their
                      // figures are noise rather than data — but they stay
                      // readable so unticking Excluded does not look like it
                      // lost them.
                      disabled={disabled || d.excluded}
                      inputMode="numeric"
                      placeholder="—"
                      aria-invalid={Boolean(mauError)}
                      className="h-8 text-right text-xs tabular-nums"
                    />
                    <Input
                      value={d.targetDau}
                      onChange={(e) =>
                        patch(d.partnerId, { targetDau: e.target.value })
                      }
                      disabled={disabled || d.excluded}
                      inputMode="numeric"
                      placeholder="—"
                      aria-invalid={Boolean(dauError)}
                      aria-label={`Target DAU for ${d.label}`}
                      className="h-8 text-right text-xs tabular-nums"
                    />
                    <div className="flex justify-center">
                      <Checkbox
                        checked={d.excluded}
                        disabled={disabled}
                        aria-label={`Exclude ${d.label} from recap totals`}
                        onCheckedChange={(checked) =>
                          patch(d.partnerId, { excluded: checked === true })
                        }
                      />
                    </div>
                  </div>
                  {mauError || dauError ? (
                    <p className="text-destructive px-1 text-xs">
                      {[mauError, dauError].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <p className="text-muted-foreground text-xs">
          {loadFailed ? (
            <span className="text-destructive">
              Could not read the current targets, so saving is disabled — it
              would overwrite them with blanks. Close and reopen to try again.
            </span>
          ) : errorCount > 0 ? (
            <span className="text-destructive">
              {errorCount} figure{errorCount === 1 ? "" : "s"} cannot be read.
            </span>
          ) : (
            `Addressable MAU set for ${configuredCount(drafts)} of ${drafts.length} telcos.`
          )}
          {orphans.length > 0
            ? ` ${orphans.length} stored row${orphans.length === 1 ? "" : "s"} for partners not in this window will be kept as-is.`
            : ""}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {canEdit ? "Cancel" : "Close"}
          </Button>
          {canEdit ? (
            <Button onClick={save} disabled={disabled || !parsed.valid}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
