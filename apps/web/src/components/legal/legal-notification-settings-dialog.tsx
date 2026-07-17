"use client";

import { Loader2, TriangleAlert, X } from "lucide-react";
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
  getLegalSettings,
  type LegalNotificationSettings,
  updateLegalSettings,
} from "@/services/legal.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Toggle field → label/description. Order matches the category list.
const CATEGORY_ROWS = [
  {
    key: "notifyContractExpiry",
    label: "Contract Expiry Tracking",
    description: "Alert when contracts tagged this category near expiry.",
  },
  {
    key: "notifyContractReview",
    label: "Contract Review",
    description: "Alert for documents in the contract-review category.",
  },
  {
    key: "notifyInitialDrafting",
    label: "Initial Contract Drafting",
    description: "Alert for documents in the initial-drafting category.",
  },
  {
    key: "notifyLicenceRenewal",
    label: "Licence Renewal Tracking",
    description: "Alert when licences tagged this category near renewal.",
  },
  {
    key: "notifyComplianceFiling",
    label: "Compliance Filing Tracking",
    description: "Alert for documents in the compliance-filing category.",
  },
  {
    key: "notifyCounterpartyReview",
    label: "Counterparty Review Tracking",
    description: "Alert for documents in the counterparty-review category.",
  },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<LegalNotificationSettings, "recipients" | "updatedAt">;
  label: string;
  description: string;
}>;

type ToggleKey = (typeof CATEGORY_ROWS)[number]["key"];

const DEFAULT_TOGGLES: Record<ToggleKey, boolean> = {
  notifyContractExpiry: true,
  notifyContractReview: true,
  notifyInitialDrafting: true,
  notifyLicenceRenewal: true,
  notifyComplianceFiling: true,
  notifyCounterpartyReview: true,
};

export function LegalNotificationSettingsDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [toggles, setToggles] =
    useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLES);
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getLegalSettings()
      .then((res) => {
        if (cancelled) return;
        applySettings(res.data);
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

  function applySettings(s: LegalNotificationSettings) {
    setEmails(s.recipients);
    setToggles({
      notifyContractExpiry: s.notifyContractExpiry,
      notifyContractReview: s.notifyContractReview,
      notifyInitialDrafting: s.notifyInitialDrafting,
      notifyLicenceRenewal: s.notifyLicenceRenewal,
      notifyComplianceFiling: s.notifyComplianceFiling,
      notifyCounterpartyReview: s.notifyCounterpartyReview,
    });
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
      const res = await updateLegalSettings({
        recipients: finalEmails,
        ...toggles,
      });
      applySettings(res.data);
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

  const noRecipients = emails.length === 0 && draft.trim() === "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Notification settings</DialogTitle>
          <DialogDescription>
            Configure who receives the Legal expiry-alert email and which
            tracking categories trigger it.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="legal-recipient-input">
                Legal team recipients
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
                  id="legal-recipient-input"
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
                    emails.length === 0 ? "legal@manut.example" : "Add another…"
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
              {noRecipients ? (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <TriangleAlert className="size-3.5" />
                  No recipients — expiry-alert emails won&apos;t be sent until
                  you add at least one.
                </p>
              ) : null}
            </div>

            <div className="space-y-3 border-t pt-4">
              <p className="text-muted-foreground text-xs">
                A document is included in the alert only when its Alert category
                (set on the document) is toggled on below.
              </p>
              {CATEGORY_ROWS.map((row) => (
                <SettingRow
                  key={row.key}
                  id={row.key}
                  label={row.label}
                  description={row.description}
                  checked={toggles[row.key]}
                  onChange={(next) =>
                    setToggles((prev) => ({ ...prev, [row.key]: next }))
                  }
                />
              ))}
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
