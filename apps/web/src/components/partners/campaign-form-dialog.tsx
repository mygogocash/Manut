"use client";

import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormDatePicker } from "@/components/shared/form-date-picker";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/error-message";
import {
  CAMPAIGN_STATUSES,
  createMarketingCampaign,
  type MarketingCampaign,
  updateMarketingCampaign,
} from "@/services/marketing.service";
import { uploadFile } from "@/services/upload.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: MarketingCampaign | null;
  onSaved: () => void;
}

const EMPTY = {
  title: "",
  campaignDate: "",
  hours: "",
  status: "planned",
  leversPulled: "",
  copyDesign: "",
  predictionFileUrl: "",
  predictionFileName: "",
};

export function CampaignFormDialog({
  open,
  onOpenChange,
  campaign,
  onSaved,
}: Props) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(campaign);

  useEffect(() => {
    if (!open) return;
    if (campaign) {
      setForm({
        title: campaign.title,
        campaignDate: campaign.campaignDate
          ? String(campaign.campaignDate).slice(0, 10)
          : "",
        hours: campaign.hours == null ? "" : String(campaign.hours),
        status: campaign.status || "planned",
        leversPulled: campaign.leversPulled ?? "",
        copyDesign: campaign.copyDesign ?? "",
        predictionFileUrl: campaign.predictionFileUrl ?? "",
        predictionFileName: campaign.predictionFileName ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, campaign]);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePredictionPick(file: File) {
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, {
        bucket: "documents",
        purpose: "campaign-prediction",
      });
      setForm((prev) => ({
        ...prev,
        predictionFileUrl: uploaded.url,
        predictionFileName: uploaded.originalName,
      }));
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't upload the prediction."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.campaignDate)) {
      toast.error("Pick a campaign date");
      return;
    }
    const payload = {
      title: form.title.trim(),
      campaignDate: form.campaignDate,
      hours: form.hours.trim() === "" ? null : Number(form.hours),
      status: form.status,
      leversPulled: form.leversPulled || null,
      copyDesign: form.copyDesign || null,
      predictionFileUrl: form.predictionFileUrl || null,
      predictionFileName: form.predictionFileName || null,
    };
    if (payload.hours != null && Number.isNaN(payload.hours)) {
      toast.error("Hours must be a number");
      return;
    }
    setSubmitting(true);
    try {
      if (campaign) {
        await updateMarketingCampaign(campaign.id, payload);
        toast.success("Campaign updated");
      } else {
        await createMarketingCampaign(payload);
        toast.success("Campaign created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't save the campaign."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            Campaign data feeds the OW Dashboard alongside the synced traction
            sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-title">Title *</Label>
            <Input
              id="campaign-title"
              placeholder="e.g. Eid Bonanza push sequence"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Date of campaign *</Label>
              <FormDatePicker
                value={form.campaignDate}
                onChange={(v) => set("campaignDate", v)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campaign-hours">Hours</Label>
              <Input
                id="campaign-hours"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 48"
                value={form.hours}
                onChange={(e) => set("hours", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-levers">Levers pulled (sequence)</Label>
            <Textarea
              id="campaign-levers"
              rows={4}
              placeholder={
                "e.g. 1 Push notification at start of campaign\n1 Push notification 1 hour before ending\nIn-app banner for the campaign duration"
              }
              value={form.leversPulled}
              onChange={(e) => set("leversPulled", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Copy &amp; design</Label>
            <RichTextEditor
              value={form.copyDesign}
              onChange={(v) => set("copyDesign", v)}
              placeholder="Notification copy + paste / upload banner designs…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Prediction sheet (xlsx)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePredictionPick(f);
              }}
            />
            {form.predictionFileName ? (
              <div
                className={`
                  border-border flex items-center gap-2 rounded-md border px-3
                  py-2 text-xs
                `}
              >
                <FileSpreadsheet className="text-muted-foreground size-4" />
                <span className="flex-1 truncate">
                  {form.predictionFileName}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      predictionFileUrl: "",
                      predictionFileName: "",
                    }))
                  }
                  aria-label="Remove prediction file"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="mr-1.5 size-3.5" />
                )}
                Upload prediction
              </Button>
            )}
            <p className="text-muted-foreground text-[11px]">
              Forecasts traffic from previous data. Stored privately; downloaded
              via a signed link.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || uploading}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEdit ? "Save changes" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
