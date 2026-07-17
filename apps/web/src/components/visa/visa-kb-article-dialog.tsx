"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import {
  createVisaArticle,
  updateVisaArticle,
  type VisaKbArticle,
} from "@/services/visa-kb.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: VisaKbArticle | null;
  onSaved: () => void;
}

export function VisaKbArticleDialog({
  open,
  onOpenChange,
  article,
  onSaved,
}: Props) {
  const isEditing = !!article;
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [visaType, setVisaType] = useState("");
  const [tags, setTags] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(article?.title ?? "");
    setCountry(article?.country ?? "");
    setVisaType(article?.visaType ?? "");
    setTags((article?.tags ?? []).join(", "));
    setIsActive(article?.isActive ?? true);
    setBody(article?.body ?? "");
  }, [open, article]);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Body is required");
      return;
    }
    const payload = {
      title: title.trim(),
      body,
      country: country.trim() || undefined,
      visaType: visaType.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
      isActive,
    };
    setSaving(true);
    try {
      if (isEditing) await updateVisaArticle(article.id, payload);
      else await createVisaArticle(payload);
      toast.success(isEditing ? "Article updated" : "Article created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit article" : "New knowledge article"}
          </DialogTitle>
          <DialogDescription>
            Immigration guidance shown on matching visa records. Leave Country
            and Visa type blank to show it on every record.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="kb-title">Title</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Thailand Non-B renewal checklist"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kb-country">Country (optional)</Label>
              <Input
                id="kb-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="All countries"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-visa-type">Visa type (optional)</Label>
              <Input
                id="kb-visa-type"
                value={visaType}
                onChange={(e) => setVisaType(e.target.value)}
                placeholder="All visa types"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kb-tags">Tags (comma-separated)</Label>
            <Input
              id="kb-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="renewal, work-permit"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Body</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write the guidance…"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="kb-active" className="text-sm font-medium">
                Active
              </Label>
              <p className="text-muted-foreground text-xs">
                Inactive articles are hidden from records.
              </p>
            </div>
            <Switch
              id="kb-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            {isEditing ? "Save changes" : "Create article"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
