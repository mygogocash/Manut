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
  getHelpdeskSettings,
  type HelpdeskNotificationSettings,
  updateHelpdeskSettings,
} from "@/services/helpdesk.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificationSettingsDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [notifyCreatorOnCreate, setNotifyCreatorOnCreate] = useState(true);
  const [notifyCreatorOnStatus, setNotifyCreatorOnStatus] = useState(true);
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getHelpdeskSettings()
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

  function applySettings(s: HelpdeskNotificationSettings) {
    setEmails(s.notifyEmails);
    setNotifyOnCreate(s.notifyOnCreate);
    setNotifyCreatorOnCreate(s.notifyCreatorOnCreate);
    setNotifyCreatorOnStatus(s.notifyCreatorOnStatus);
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
      const res = await updateHelpdeskSettings({
        notifyEmails: finalEmails,
        notifyOnCreate,
        notifyCreatorOnCreate,
        notifyCreatorOnStatus,
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
            Configure who receives an email when new IT helpdesk tickets are
            opened, and what the requester is notified about.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="helpdesk-recipient-input">
                IT team recipients
              </Label>
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
                  id="helpdesk-recipient-input"
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
                    emails.length === 0 ? "it@manut.example" : "Add another…"
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
                id="notify-on-create"
                label="Notify IT team on new tickets"
                description="Send the new-ticket email to the recipients above."
                checked={notifyOnCreate}
                onChange={setNotifyOnCreate}
              />
              <SettingRow
                id="notify-creator-on-create"
                label="Confirm to requester on submit"
                description="Send a confirmation email to the person who opened the ticket."
                checked={notifyCreatorOnCreate}
                onChange={setNotifyCreatorOnCreate}
              />
              <SettingRow
                id="notify-creator-on-status"
                label="Notify requester on status change"
                description="Email the requester when the ticket moves between statuses."
                checked={notifyCreatorOnStatus}
                onChange={setNotifyCreatorOnStatus}
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
