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
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import {
  type CrmNotificationSettings,
  getCrmSettings,
  updateCrmSettings,
} from "@/services/crm-settings.service";

// Mirrors `helpdesk/notification-settings-dialog.tsx` — same UX
// (badge-list email chips, Enter/comma/blur commit, Backspace pop),
// adapted for Sales CRM event semantics. Three toggles map 1:1 to the
// `crm_settings` table columns.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CrmNotificationSettingsDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [notifyOwnerOnCreate, setNotifyOwnerOnCreate] = useState(true);
  const [notifyOwnerOnStageChange, setNotifyOwnerOnStageChange] =
    useState(true);
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getCrmSettings()
      .then((res) => {
        if (cancelled) return;
        applySettings(res.data);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Failed to load notification settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function applySettings(s: CrmNotificationSettings) {
    setEmails(s.notifyEmails);
    setNotifyOnCreate(s.notifyOnCreate);
    setNotifyOwnerOnCreate(s.notifyOwnerOnCreate);
    setNotifyOwnerOnStageChange(s.notifyOwnerOnStageChange);
    setDraft("");
  }

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
    // Auto-commit the typed draft so the operator doesn't lose a pending
    // email when clicking Save without pressing Enter.
    const candidate = draft.trim().toLowerCase();
    let finalEmails = emails;
    if (candidate) {
      if (!EMAIL_RE.test(candidate)) {
        toast.error("Invalid email address");
        draftRef.current?.focus();
        return;
      }
      if (!emails.includes(candidate)) {
        finalEmails = [...emails, candidate];
      }
    }
    setSaving(true);
    try {
      const res = await updateCrmSettings({
        notifyEmails: finalEmails,
        notifyOnCreate,
        notifyOwnerOnCreate,
        notifyOwnerOnStageChange,
      });
      applySettings(res.data);
      toast.success("Notification settings saved");
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save settings";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Notification settings</DialogTitle>
          <DialogDescription>
            Configure who receives an email when new opportunities are opened or
            move between stages, and what the opportunity owner is notified
            about.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="crm-recipient-input">CRM team recipients</Label>
              <div
                className={`flex flex-wrap gap-1.5 rounded-md border px-2 py-2`}
              >
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
                  id="crm-recipient-input"
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
                    emails.length === 0 ? "bd@manut.example" : "Add another…"
                  }
                  className={`
                    h-7 min-w-[180px] flex-1 border-none p-0 shadow-none
                    focus-visible:ring-0
                  `}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Press Enter or comma to add. Up to 50 recipients.
              </p>
            </div>

            <div className="space-y-3 border-t pt-4">
              <SettingRow
                id="crm-notify-on-create"
                label="Notify CRM team on new opportunities"
                description="Send a fan-out email to the recipients above whenever a new opportunity is created or moves to another stage."
                checked={notifyOnCreate}
                onChange={setNotifyOnCreate}
              />
              <SettingRow
                id="crm-notify-owner-on-create"
                label="Confirm to owner on submit"
                description="Send a confirmation email to the opportunity owner when their deal is created."
                checked={notifyOwnerOnCreate}
                onChange={setNotifyOwnerOnCreate}
              />
              <SettingRow
                id="crm-notify-owner-on-stage-change"
                label="Notify owner on stage change"
                description="Email the opportunity owner whenever the deal moves between pipeline stages."
                checked={notifyOwnerOnStageChange}
                onChange={setNotifyOwnerOnStageChange}
              />
            </div>
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

function SettingRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
