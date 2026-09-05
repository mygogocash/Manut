"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { type VisaParseResult } from "@/services/visa.service";

// Applicable fields map 1:1 to a form input; the user can tick which to
// apply. `visaType` is shown for reference only (the form's Visa type is a
// fixed-option select, so we never auto-write a free-text OCR value into it).
const APPLICABLE_FIELDS: Array<{ key: keyof VisaParseResult; label: string }> =
  [
    { key: "holderName", label: "Holder name" },
    { key: "country", label: "Country of issue" },
    { key: "nationality", label: "Nationality" },
    { key: "issueDate", label: "Issue date" },
    { key: "expiryDate", label: "Expiry date" },
    { key: "workPermitNumber", label: "Work permit number" },
    { key: "workPermitIssueDate", label: "Work permit issue date" },
    { key: "workPermitExpiryDate", label: "Work permit expiry date" },
  ];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: VisaParseResult | null;
  // Holder name only maps to a form field for dependent records.
  canApplyHolderName: boolean;
  onApply: (selected: Partial<Record<keyof VisaParseResult, boolean>>) => void;
}

export function VisaOcrConfirmDialog({
  open,
  onOpenChange,
  result,
  canApplyHolderName,
  onApply,
}: Props) {
  const rows = useMemo(
    () =>
      APPLICABLE_FIELDS.filter(
        (f) => f.key !== "holderName" || canApplyHolderName,
      ),
    [canApplyHolderName],
  );

  const [checked, setChecked] = useState<
    Partial<Record<keyof VisaParseResult, boolean>>
  >({});

  // Default-check every field the model actually returned a value for, so a
  // blank/undetected field can't silently overwrite an existing form value.
  useEffect(() => {
    if (!result) return;
    const next: Partial<Record<keyof VisaParseResult, boolean>> = {};
    for (const f of rows) next[f.key] = Boolean(result[f.key]);
    setChecked(next);
  }, [result, rows]);

  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Extracted fields
          </DialogTitle>
          <DialogDescription>
            Review what was read from the scan and choose which fields to apply.
            Nothing is saved until you submit the form.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1">
          {result.visaType ? (
            <div
              className={`
                border-border/60 text-muted-foreground rounded-md border
                border-dashed p-2 text-xs
              `}
            >
              Detected visa type:{" "}
              <span className="text-foreground font-medium">
                {result.visaType}
              </span>{" "}
              — set the Visa type field manually.
            </div>
          ) : null}

          {rows.map((f) => {
            const value = result[f.key];
            const detected = Boolean(value);
            return (
              <label
                key={f.key}
                htmlFor={`ocr-${f.key}`}
                className={`
                  flex items-center gap-3 rounded-md border p-2
                  ${
                    detected
                      ? "border-border/60 cursor-pointer"
                      : `border-border/30 opacity-60`
                  }
                `}
              >
                <Checkbox
                  id={`ocr-${f.key}`}
                  checked={Boolean(checked[f.key])}
                  disabled={!detected}
                  onCheckedChange={(v) =>
                    setChecked((prev) => ({ ...prev, [f.key]: Boolean(v) }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <Label
                    htmlFor={`ocr-${f.key}`}
                    className="text-xs font-medium"
                  >
                    {f.label}
                  </Label>
                  <div className="text-foreground truncate text-sm">
                    {detected ? value : "(not detected)"}
                  </div>
                </div>
              </label>
            );
          })}

          {result.parsingNotes ? (
            <p className="text-muted-foreground mt-1 text-[11px]">
              {result.parsingNotes}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(checked);
              onOpenChange(false);
            }}
          >
            Apply selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
