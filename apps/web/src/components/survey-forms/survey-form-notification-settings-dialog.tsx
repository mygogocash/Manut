"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/services/survey-form.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SurveyFormNotificationSettingsDialog({
  open,
  onOpenChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getNotificationSettings()
      .then((res) => {
        if (cancelled) return;
        setEmails(res.data.recipients);
        setDraft("");
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load notification settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function commitDraft() {
    const candidate = draft.trim().toLowerCase();
    if (!candidate) return;
    if (!EMAIL_RE.test(candidate)) {
      toast.error("Invalid email address");
      return;
    }
    if (emails.includes(candidate)) {
      setDraft("");
      return;
    }
    if (emails.length >= 50) {
      toast.error("At most 50 recipients");
      return;
    }
    setEmails((prev) => [...prev, candidate]);
    setDraft("");
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email));
  }

  async function handleSave() {
    const candidate = draft.trim().toLowerCase();
    let finalEmails = emails;
    if (candidate) {
      if (!EMAIL_RE.test(candidate)) {
        toast.error("Invalid email address");
        draftRef.current?.focus();
        return;
      }
      if (!emails.includes(candidate)) finalEmails = [...emails, candidate];
    }
    setSaving(true);
    try {
      const res = await updateNotificationSettings({ recipients: finalEmails });
      setEmails(res.data.recipients);
      setDraft("");
      toast.success("Notification settings saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notification settings</DialogTitle>
          <DialogDescription>
            Choose who is emailed when someone submits a response to an award
            form you launched.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <Label htmlFor="award-recipient-input">Recipients</Label>
            <div className="flex flex-wrap gap-1.5 rounded-md border px-2 py-2">
              {emails.map((email) => (
                <Badge
                  key={email}
                  variant="secondary"
                  className="gap-1 pr-1 text-xs"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    aria-label={`Remove ${email}`}
                    className={`
                      hover:bg-muted-foreground/20
                      ml-0.5 rounded p-0.5
                    `}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <Input
                ref={draftRef}
                id="award-recipient-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    commitDraft();
                  } else if (
                    e.key === "Backspace" &&
                    draft === "" &&
                    emails.length > 0
                  ) {
                    setEmails((prev) => prev.slice(0, -1));
                  }
                }}
                onBlur={commitDraft}
                placeholder={
                  emails.length === 0
                    ? "hr@thebinaryholdings.com"
                    : "Add another…"
                }
                className={`
                  h-7 min-w-[180px] flex-1 border-none p-0 shadow-none
                  focus-visible:ring-0
                `}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Press Enter or comma to add. Up to 50 recipients. Leave empty to
              keep the default (the form owner plus Admin/HR).
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
