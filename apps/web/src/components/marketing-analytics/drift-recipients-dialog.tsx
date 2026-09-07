"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { parseRecipients } from "@/components/marketing-analytics/drift-recipients";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  getDriftSettings,
  updateDriftSettings,
} from "@/services/marketing-analytics.service";

/**
 * Who gets emailed when the daily DAU/MAU drift check finds something.
 *
 * Until this existed the list could only be set by hand-writing a row into
 * each environment's database, which meant the alert shipped disarmed and
 * stayed that way — the check ran daily, found nothing to tell anyone, and
 * looked healthy doing it.
 */
export function DriftRecipientsDialog({
  open,
  onOpenChange,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-fetch on each open rather than caching: this is org-wide config, so
  // another admin may have changed it since the page loaded, and saving a
  // stale list would silently drop their edit.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getDriftSettings()
      .then((res) => {
        if (!cancelled) setText(res.data.recipients.join("\n"));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(
          err instanceof ApiError ? err.message : "Failed to load recipients",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const parsed = parseRecipients(text);

  const save = async () => {
    if (parsed.invalid.length > 0) {
      toast.error(`Not an email address: ${parsed.invalid.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const res = await updateDriftSettings(parsed.valid);
      setText(res.data.recipients.join("\n"));
      toast.success(
        res.data.recipients.length === 0
          ? "Drift alert email is now off"
          : `Drift alerts go to ${res.data.recipients.length} recipient${
              res.data.recipients.length === 1 ? "" : "s"
            }`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save recipients",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Drift alert recipients</DialogTitle>
          <DialogDescription>
            Emailed when the daily check finds the stored metrics disagreeing
            with the BNII API, or a dashboard total disagreeing with its parts.
            One address per line. Leave empty to turn the email off — the check
            still runs and still reports, it just tells nobody.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="drift-recipients" className="text-xs uppercase">
            Recipients
          </Label>
          <Textarea
            id="drift-recipients"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!canEdit || loading || saving}
            rows={6}
            placeholder={loading ? "Loading…" : "name@manut.xyz"}
            className="font-mono text-xs"
          />
          <p className="text-muted-foreground text-xs">
            {parsed.invalid.length > 0 ? (
              <span className="text-destructive">
                Not an email address: {parsed.invalid.join(", ")}
              </span>
            ) : parsed.valid.length === 0 ? (
              "No recipients — the alert email is off."
            ) : (
              `${parsed.valid.length} recipient${parsed.valid.length === 1 ? "" : "s"}`
            )}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={
              !canEdit || loading || saving || parsed.invalid.length > 0
            }
          >
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
