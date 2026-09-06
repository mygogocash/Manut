"use client";

import { useEffect, useState } from "react";

import { DatePickerField } from "@/components/survey/date-picker-field";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/providers/auth-provider";
import {
  getAnnouncementSettings,
  type SurveyAnnounceOptions,
} from "@/services/survey.service";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-sm">{label}</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SurveyPublishDialog({
  open,
  onOpenChange,
  formTitle,
  publishing,
  onConfirm,
  heading = "Publish & announce",
  description = "Publishing makes the survey live for its audience. Optionally broadcast it across the intranet.",
  confirmLabel = "Publish",
  confirmingLabel = "Publishing…",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  formTitle: string;
  publishing: boolean;
  onConfirm: (announce: SurveyAnnounceOptions) => void;
  heading?: string;
  description?: string;
  confirmLabel?: string;
  confirmingLabel?: string;
}) {
  const { hasPermission } = useAuth();
  const canWall = hasPermission("wall:create");
  const canNews = hasPermission("news:create");
  const canDate = hasPermission("admin:manage");

  const [wall, setWall] = useState(true);
  const [news, setNews] = useState(true);
  const [companyDate, setCompanyDate] = useState(true);
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);

  // On open, seed from the admin-configured announcement defaults (falling
  // back to all-on). Toggles are always intersected with what this actor
  // is allowed to write to.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setWall(canWall);
    setNews(canNews);
    setCompanyDate(canDate);
    setMessage(
      `New survey: "${formTitle}" is now open. Share your input on the Manut.`,
    );
    setDeadline(undefined);
    getAnnouncementSettings()
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        setWall(canWall && d.wall);
        setNews(canNews && d.news);
        setCompanyDate(canDate && d.companyDate);
        setMessage(d.messageTemplate.replace(/\{title\}/g, formTitle));
      })
      .catch(() => {
        // Keep the fallback defaults on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [open, formTitle, canWall, canNews, canDate]);

  const confirm = () => {
    onConfirm({
      wall: canWall && wall,
      news: canNews && news,
      companyDate: canDate && companyDate && Boolean(deadline),
      message: message.trim() || undefined,
      deadline: deadline ? deadline.toISOString().slice(0, 10) : undefined,
    });
  };

  const noSurfaces = !canWall && !canNews && !canDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {canWall && (
            <ToggleRow
              label="Post to Company Wall"
              description="Share an internal post linking to the survey."
              checked={wall}
              onChange={setWall}
            />
          )}
          {canNews && (
            <ToggleRow
              label="Add to Company News"
              description="Publish an announcement in the news feed."
              checked={news}
              onChange={setNews}
            />
          )}
          {canDate && (
            <ToggleRow
              label="Add a Company Dates entry"
              description="Adds a calendar milestone — needs a deadline below."
              checked={companyDate}
              onChange={setCompanyDate}
            />
          )}

          <p className="text-muted-foreground text-xs">
            Targeted members will also see this survey in their notification
            bell until they respond.
          </p>

          <div className="grid gap-2">
            <Label htmlFor="announce-message">Announcement message</Label>
            <Textarea
              id="announce-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional — a default message is used if left blank."
            />
          </div>

          {canDate && companyDate && (
            <div className="grid gap-2">
              <Label>Responses close (optional)</Label>
              <DatePickerField
                value={deadline}
                onChange={setDeadline}
                placeholder="Pick a deadline"
              />
              <p className="text-muted-foreground text-xs">
                A &quot;Survey closes&quot; entry is added to Company Dates only
                when a date is set.
              </p>
            </div>
          )}

          {noSurfaces && (
            <p className="text-muted-foreground text-xs">
              You don&apos;t have permission to post to the wall, news, or
              calendar — the survey will still publish and reach targeted
              members&apos; notification bell.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishing}
          >
            Cancel
          </Button>
          <Button onClick={confirm} disabled={publishing}>
            {publishing ? confirmingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
