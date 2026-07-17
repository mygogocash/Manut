"use client";

import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import {
  type ChecklistCategory,
  type ChecklistTemplateItem,
  createChecklistTemplate,
  updateChecklistTemplate,
  type VisaChecklistTemplate,
} from "@/services/visa-checklist.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: VisaChecklistTemplate | null;
  onSaved: () => void;
}

function newItem(sortOrder: number): ChecklistTemplateItem {
  return {
    id: crypto.randomUUID(),
    label: "",
    category: "document",
    optional: false,
    sortOrder,
  };
}

export function VisaChecklistTemplateDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: Props) {
  const isEditing = !!template;
  const [visaType, setVisaType] = useState("");
  const [country, setCountry] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVisaType(template?.visaType ?? "");
    setCountry(template?.country ?? "");
    setName(template?.name ?? "");
    setIsActive(template?.isActive ?? true);
    setItems(template?.items ?? []);
  }, [open, template]);

  function updateItem(id: string, patch: Partial<ChecklistTemplateItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function handleSave() {
    if (!visaType.trim()) {
      toast.error("Visa type is required");
      return;
    }
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    const cleanItems = items
      .map((it, i) => ({ ...it, label: it.label.trim(), sortOrder: i }))
      .filter((it) => it.label.length > 0);
    if (cleanItems.length === 0) {
      toast.error("Add at least one checklist item");
      return;
    }
    const payload = {
      visaType: visaType.trim(),
      country: country.trim() || undefined,
      name: name.trim(),
      items: cleanItems,
      isActive,
    };
    setSaving(true);
    try {
      if (isEditing) await updateChecklistTemplate(template.id, payload);
      else await createChecklistTemplate(payload);
      toast.success(isEditing ? "Template updated" : "Template created");
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
            {isEditing ? "Edit checklist template" : "New checklist template"}
          </DialogTitle>
          <DialogDescription>
            Required documents and process steps applied to new records of this
            visa type. Leave Country blank to apply to every country.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-visa-type">Visa type</Label>
              <Input
                id="ct-visa-type"
                value={visaType}
                onChange={(e) => setVisaType(e.target.value)}
                placeholder="e.g. work_visa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-country">Country (optional)</Label>
              <Input
                id="ct-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="All countries"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ct-name">Template name</Label>
            <Input
              id="ct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Thailand work visa onboarding"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((prev) => [...prev, newItem(prev.length)])
                }
              >
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-xs">No items yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2">
                    <GripVertical
                      className={`text-muted-foreground size-4 shrink-0`}
                    />
                    <Input
                      value={it.label}
                      onChange={(e) =>
                        updateItem(it.id, { label: e.target.value })
                      }
                      placeholder="Item label"
                      className="flex-1"
                    />
                    <Select
                      value={it.category}
                      onValueChange={(v) =>
                        updateItem(it.id, { category: v as ChecklistCategory })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="document">Document</SelectItem>
                        <SelectItem value="step">Step</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="flex shrink-0 items-center gap-1 text-xs">
                      <Switch
                        checked={it.optional}
                        onCheckedChange={(v) =>
                          updateItem(it.id, { optional: v })
                        }
                      />
                      Optional
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setItems((prev) => prev.filter((x) => x.id !== it.id))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ct-active" className="text-sm font-medium">
              Active
            </Label>
            <Switch
              id="ct-active"
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
            {isEditing ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
