"use client";

import { Loader2 } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  getAnnouncementSettings,
  updateAnnouncementSettings,
} from "@/services/survey-form.service";

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

export function SurveyFormAnnouncementSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wall, setWall] = useState(true);
  const [news, setNews] = useState(true);
  const [companyDate, setCompanyDate] = useState(true);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [newsCategory, setNewsCategory] = useState("Survey");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getAnnouncementSettings()
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        setWall(d.wall);
        setNews(d.news);
        setCompanyDate(d.companyDate);
        setMessageTemplate(d.messageTemplate);
        setNewsCategory(d.newsCategory);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load announcement settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateAnnouncementSettings({
        wall,
        news,
        companyDate,
        messageTemplate,
        newsCategory: newsCategory.trim() || "Survey",
      });
      toast.success("Announcement settings saved");
      onOpenChange(false);
      // Echo back the normalised values for the next open.
      setNewsCategory(res.data.newsCategory);
      setMessageTemplate(res.data.messageTemplate);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Announcement settings</DialogTitle>
          <DialogDescription>
            Defaults applied when a survey is published. Editors can still
            adjust these per survey in the publish dialog.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <ToggleRow
              label="Post to Company Wall by default"
              description="Pre-tick the wall option in the publish dialog."
              checked={wall}
              onChange={setWall}
            />
            <ToggleRow
              label="Add to Company News by default"
              description="Pre-tick the news option in the publish dialog."
              checked={news}
              onChange={setNews}
            />
            <ToggleRow
              label="Add a Company Dates entry by default"
              description="Pre-tick the calendar option (still needs a deadline)."
              checked={companyDate}
              onChange={setCompanyDate}
            />

            <div className="grid gap-2">
              <Label htmlFor="announce-template">Default message</Label>
              <Textarea
                id="announce-template"
                rows={3}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder='New survey: "{title}" is now open.'
              />
              <p className="text-muted-foreground text-xs">
                Use <code>{"{title}"}</code> as a placeholder for the survey
                title.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="announce-category">News category</Label>
              <Input
                id="announce-category"
                value={newsCategory}
                onChange={(e) => setNewsCategory(e.target.value)}
                placeholder="Survey"
              />
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
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Spinner className="mr-2" />}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
