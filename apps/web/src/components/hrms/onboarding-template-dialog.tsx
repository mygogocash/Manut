"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  cleanParts,
  type EditablePart,
  PartsEditor,
} from "@/components/hrms/parts-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/error-message";
import {
  getOnboardingTemplate,
  updateOnboardingTemplate,
} from "@/services/hrms.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingTemplateDialog({ open, onOpenChange }: Props) {
  const [parts, setParts] = useState<EditablePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let cancelled = false;
    void getOnboardingTemplate()
      .then((res) => {
        if (cancelled) return;
        setParts(
          (res.data?.parts ?? []).map((p) => ({
            name: p.name,
            tasks: [...p.tasks],
          })),
        );
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(getErrorMessage(err, "Failed to load the template"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSave() {
    const cleaned = cleanParts(parts);
    if (cleaned.length === 0) {
      toast.error("Add at least one part with a task");
      return;
    }
    setSaving(true);
    try {
      await updateOnboardingTemplate({ parts: cleaned });
      toast.success("Template saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't save the template."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>Manage onboarding template</DialogTitle>
          <DialogDescription>
            Default parts &amp; tasks every new onboarding run starts from.
            Existing runs are unaffected.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : (
          <PartsEditor parts={parts} onChange={setParts} />
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="min-w-28"
          >
            {saving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
