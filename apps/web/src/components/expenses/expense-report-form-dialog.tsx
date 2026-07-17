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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import type { Entity } from "@/services/entity.service";
import {
  createExpenseReport,
  type ExpenseCategoryKey,
  type ExpenseReportSummary,
  updateExpenseReport,
} from "@/services/expense.service";

interface ExpenseReportFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (report: ExpenseReportSummary) => void;
  entities: Entity[];
  // Pass an existing report to enter edit mode. `period` and `title`
  // are still editable while the report is in draft / rejected, so the
  // same dialog handles both create and edit paths.
  report?: ExpenseReportSummary | null;
}

function thisPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function defaultTitle(period: string) {
  const [y, m] = period.split("-");
  if (!y || !m) return "Expense report";
  const date = new Date(Number(y), Number(m) - 1, 1);
  return `Expenses — ${date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })}`;
}

export function ExpenseReportFormDialog({
  open,
  onOpenChange,
  onSaved,
  entities,
  report,
}: ExpenseReportFormDialogProps) {
  const isEdit = !!report;
  const { hasPermission } = useAuth();
  // Office category is finance-admin only. We still render it for an
  // edit where the report already carries it (so the operator doesn't
  // see a blank-looking value), but new picks are gated.
  const canPickOffice =
    hasPermission("expense:hr-approve") || hasPermission("expense:hr-read");

  const [entityId, setEntityId] = useState<string>("");
  const [period, setPeriod] = useState<string>(thisPeriod());
  const [title, setTitle] = useState<string>(defaultTitle(thisPeriod()));
  const [category, setCategory] = useState<ExpenseCategoryKey>("general");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (report) {
      setEntityId(report.entity.id);
      setPeriod(report.period);
      setTitle(report.title);
      setCategory(report.category ?? "general");
      setNotes(report.notes ?? "");
    } else {
      const p = thisPeriod();
      setEntityId(entities[0]?.id ?? "");
      setPeriod(p);
      setTitle(defaultTitle(p));
      setCategory("general");
      setNotes("");
    }
  }, [open, report, entities]);

  // Auto-update the suggested title when the period changes for a brand
  // new report — but leave HR's edits untouched once they've typed
  // something custom.
  useEffect(() => {
    if (isEdit) return;
    setTitle((prev) => {
      const auto = defaultTitle(period);
      const previousAuto =
        prev.startsWith("Expenses — ") || prev === "" || prev === auto;
      return previousAuto ? auto : prev;
    });
  }, [period, isEdit]);

  async function handleSubmit() {
    if (!entityId) {
      toast.error("Pick an entity");
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      toast.error("Period must be YYYY-MM");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      setSubmitting(true);
      const res = isEdit
        ? await updateExpenseReport(report.id, {
            title: title.trim(),
            period,
            category,
            notes: notes.trim() || undefined,
          })
        : await createExpenseReport({
            entityId,
            period,
            title: title.trim(),
            category,
            notes: notes.trim() || undefined,
          });
      toast.success(isEdit ? "Report updated" : "Report created");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save report";
      toast.error(msg);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit expense report" : "New expense report"}
          </DialogTitle>
          <DialogDescription>
            Reports group every expense for a month into one approval. After you
            add the expenses, hit Submit and your line manager will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="report-entity">Entity</Label>
            <Select
              value={entityId}
              onValueChange={setEntityId}
              disabled={isEdit}
            >
              <SelectTrigger id="report-entity" className="w-full">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="report-period">Period (YYYY-MM)</Label>
            <Input
              id="report-period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="report-title">Title</Label>
            <Input
              id="report-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Expenses — May 2026"
            />
          </div>
          <div>
            <Label htmlFor="report-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ExpenseCategoryKey)}
            >
              <SelectTrigger id="report-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="business_or_bd">
                  Business travel / BD
                </SelectItem>
                {(canPickOffice || category === "office") && (
                  <SelectItem value="office">Office</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Drives amount-band approval routing. Pick &ldquo;Business travel /
              BD&rdquo; for trips/BD-related spend.
              {canPickOffice ? (
                <>
                  {" "}
                  &ldquo;Office&rdquo; is for shared office spend filed by HR /
                  Admin — the submitter shows as &ldquo;Office Admin&rdquo; in
                  every list.
                </>
              ) : null}
            </p>
          </div>
          <div>
            <Label htmlFor="report-notes">Notes</Label>
            <Textarea
              id="report-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the approver should know…"
              rows={3}
            />
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
            onClick={handleSubmit}
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
