"use client";

import { FolderGit2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import {
  getHelpdeskSettings,
  updateHelpdeskSettings,
} from "@/services/helpdesk.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Admin dialog for the IT Helpdesk ↔ GitHub Issues two-way sync
 * (Sid + BD feedback, 2026-05-24).
 *
 * Token + webhook secret are write-only: the API never echoes them
 * back, the field shows "configured" when a value is stored, and the
 * caller leaves the field empty to preserve it.
 */
export function GithubWorkflowConfigDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [labelInProgress, setLabelInProgress] = useState("in progress");
  const [labelReview, setLabelReview] = useState("review");

  // Carry the rest of the notification-settings payload through the
  // save call — `PUT /helpdesk/settings` is the single endpoint for
  // both panels, so we have to round-trip the notify flags too.
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [notifyCreatorOnCreate, setNotifyCreatorOnCreate] = useState(true);
  const [notifyCreatorOnStatus, setNotifyCreatorOnStatus] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getHelpdeskSettings()
      .then((res) => {
        if (cancelled) return;
        const s = res.data;
        setNotifyEmails(s.notifyEmails);
        setNotifyOnCreate(s.notifyOnCreate);
        setNotifyCreatorOnCreate(s.notifyCreatorOnCreate);
        setNotifyCreatorOnStatus(s.notifyCreatorOnStatus);
        const g = s.github;
        setEnabled(g.enabled);
        setRepoOwner(g.repoOwner ?? "");
        setRepoName(g.repoName ?? "");
        setHasToken(g.hasToken);
        setHasWebhookSecret(g.hasWebhookSecret);
        setLabelInProgress(g.labelInProgress);
        setLabelReview(g.labelReview);
        setToken("");
        setWebhookSecret("");
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Failed to load workflow settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSave() {
    if (enabled && (!repoOwner.trim() || !repoName.trim())) {
      toast.error("Repo owner and name are required when sync is enabled");
      return;
    }
    if (enabled && !hasToken && !token.trim()) {
      toast.error("GitHub token is required on first enable");
      return;
    }
    try {
      setSaving(true);
      await updateHelpdeskSettings({
        notifyEmails,
        notifyOnCreate,
        notifyCreatorOnCreate,
        notifyCreatorOnStatus,
        github: {
          enabled,
          repoOwner: repoOwner.trim(),
          repoName: repoName.trim(),
          token: token.trim() || undefined,
          webhookSecret: webhookSecret.trim() || undefined,
          labelInProgress: labelInProgress.trim(),
          labelReview: labelReview.trim(),
        },
      });
      toast.success("GitHub workflow settings saved");
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="size-4" />
            GitHub workflow configuration
          </DialogTitle>
          <DialogDescription>
            Sync IT Helpdesk tickets to a GitHub repo. State changes on the
            issue flow back to the ticket status automatically.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="gh-enabled" className="text-sm font-medium">
                  Enable GitHub sync
                </Label>
                <p className="text-muted-foreground text-xs">
                  When on, every new ticket creates a matching issue.
                </p>
              </div>
              <Switch
                id="gh-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gh-owner" className="text-sm">
                  Repo owner
                </Label>
                <Input
                  id="gh-owner"
                  placeholder="mygogocash"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gh-repo" className="text-sm">
                  Repo name
                </Label>
                <Input
                  id="gh-repo"
                  placeholder="new-tbh-intranet"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gh-token" className="text-sm">
                Personal access token{" "}
                {hasToken ? (
                  <span className="text-muted-foreground text-[11px]">
                    (configured — leave blank to keep)
                  </span>
                ) : (
                  <span className="text-destructive text-[11px]">
                    (required)
                  </span>
                )}
              </Label>
              <Input
                id="gh-token"
                type="password"
                placeholder={hasToken ? "••••••••" : "ghp_…"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={saving}
                autoComplete="off"
              />
              <p className="text-muted-foreground text-xs">
                Scopes needed: <code>repo</code> (read + write issues).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gh-secret" className="text-sm">
                Webhook secret{" "}
                {hasWebhookSecret ? (
                  <span className="text-muted-foreground text-[11px]">
                    (configured — leave blank to keep)
                  </span>
                ) : null}
              </Label>
              <Input
                id="gh-secret"
                type="password"
                placeholder={hasWebhookSecret ? "••••••••" : "shared HMAC seed"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                disabled={saving}
                autoComplete="off"
              />
              <p className="text-muted-foreground text-xs">
                Use the same value on the GitHub webhook page. Webhook URL:{" "}
                <code>/api/helpdesk-public/github/webhook</code>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gh-label-prog" className="text-sm">
                  Label → In Progress
                </Label>
                <Input
                  id="gh-label-prog"
                  value={labelInProgress}
                  onChange={(e) => setLabelInProgress(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gh-label-rev" className="text-sm">
                  Label → Review
                </Label>
                <Input
                  id="gh-label-rev"
                  value={labelReview}
                  onChange={(e) => setLabelReview(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div
              className={`
                bg-muted/40 text-muted-foreground rounded-md border p-3 text-xs
                leading-relaxed
              `}
            >
              <strong>Transitions</strong>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>
                  Issue gets <em>{labelInProgress || "in progress"}</em> label →
                  ticket → In Progress + email requester
                </li>
                <li>
                  PR merged that <code>closes #N</code> → ticket → Review +
                  email
                </li>
                <li>Issue closed → ticket → Resolved + email</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={loading || saving}
          >
            {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
