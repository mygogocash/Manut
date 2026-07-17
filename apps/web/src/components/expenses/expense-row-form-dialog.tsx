"use client";

import { ExternalLink, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormDatePicker } from "@/components/shared/form-date-picker";
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
import {
  addExpenseToReport,
  type Expense,
  type ExpenseCategory,
  updateExpenseInReport,
} from "@/services/expense.service";
import { uploadFile } from "@/services/upload.service";

interface ExpenseRowFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  reportId: string;
  defaultCurrency: string;
  categories: ExpenseCategory[];
  expense?: Expense | null;
}

const NO_CATEGORY = "__none__";

export function ExpenseRowFormDialog({
  open,
  onOpenChange,
  onSaved,
  reportId,
  defaultCurrency,
  categories,
  expense,
}: ExpenseRowFormDialogProps) {
  const isEdit = !!expense;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [receiptMime, setReceiptMime] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setDescription(expense.description);
      setAmount(expense.amount);
      setCurrency(expense.currency);
      setDate(expense.date.slice(0, 10));
      setCategoryId(expense.category?.id ?? NO_CATEGORY);
      setReceiptUrl(expense.receiptUrl ?? "");
      setReceiptName(expense.receiptUrl ? "Existing receipt" : null);
      setReceiptMime(
        expense.receiptUrl ? guessMimeFromUrl(expense.receiptUrl) : null,
      );
      setNotes(expense.notes ?? "");
    } else {
      setDescription("");
      setAmount("");
      setCurrency(defaultCurrency);
      setDate(new Date().toISOString().slice(0, 10));
      setCategoryId(NO_CATEGORY);
      setReceiptUrl("");
      setReceiptName(null);
      setReceiptMime(null);
      setNotes("");
    }
  }, [open, expense, defaultCurrency]);

  async function handleReceiptPick(file: File) {
    try {
      setUploading(true);
      const uploaded = await uploadFile(file, {
        bucket: "receipts",
        purpose: "expense-receipt",
      });
      setReceiptUrl(uploaded.url);
      setReceiptName(uploaded.originalName);
      setReceiptMime(uploaded.mimeType ?? file.type ?? null);
      toast.success("Receipt uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Receipt upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  }

  function handleClearReceipt() {
    setReceiptUrl("");
    setReceiptName(null);
    setReceiptMime(null);
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("Date must be YYYY-MM-DD");
      return;
    }

    const payload = {
      description: description.trim(),
      amount: num,
      currency: currency.trim().toUpperCase() || defaultCurrency,
      date,
      ...(categoryId !== NO_CATEGORY && { categoryId }),
      ...(receiptUrl.trim() && { receiptUrl: receiptUrl.trim() }),
      ...(notes.trim() && { notes: notes.trim() }),
    };

    try {
      setSubmitting(true);
      if (isEdit) {
        await updateExpenseInReport(reportId, expense.id, payload);
        toast.success("Expense updated");
      } else {
        await addExpenseToReport(reportId, payload);
        toast.success("Expense added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save expense";
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
      <DialogContent
        className={`
          flex max-h-[92vh] flex-col gap-3 overflow-y-auto
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            Receipts and notes are optional but help the approver review the
            report faster.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="exp-description">Description</Label>
            <Input
              id="exp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Taxi to client meeting"
            />
          </div>
          <div
            className={`
              grid grid-cols-1 gap-2
              sm:grid-cols-3
            `}
          >
            <div className="sm:col-span-2">
              <Label htmlFor="exp-amount">Amount</Label>
              <Input
                id="exp-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="exp-currency">Currency</Label>
              <Input
                id="exp-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="THB"
              />
            </div>
          </div>
          <div
            className={`
              grid grid-cols-1 gap-2
              sm:grid-cols-2
            `}
          >
            <div>
              <Label htmlFor="exp-date">Date</Label>
              <FormDatePicker value={date} onChange={setDate} />
            </div>
            <div>
              <Label htmlFor="exp-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="exp-category" className="w-full">
                  <SelectValue placeholder="Pick category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Receipt</Label>
            <input
              ref={receiptInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleReceiptPick(f);
              }}
            />
            {receiptUrl ? (
              <div
                className={`
                  border-border bg-card flex flex-col gap-2 rounded-md border
                  p-2.5 text-sm
                `}
              >
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      text-primary inline-flex min-w-0 items-center gap-1
                      truncate
                      hover:underline
                    `}
                  >
                    <ExternalLink className="size-3.5" />
                    {receiptName ?? "Receipt"}
                  </a>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => receiptInputRef.current?.click()}
                      disabled={uploading || submitting}
                    >
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearReceipt}
                      disabled={uploading || submitting}
                      aria-label="Remove receipt"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {/*
                  Inline preview so the submitter (and the approver later
                  on) can sanity-check the upload without leaving the
                  dialog. Images render as a thumbnail; PDFs embed in a
                  small iframe — both are click-through to the full file.
                */}
                {isImageMime(receiptMime) ? (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      border-border bg-muted/20 block w-full max-w-xs self-start
                      overflow-hidden rounded-md border
                    `}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receiptUrl}
                      alt={receiptName ?? "Receipt preview"}
                      className="h-44 w-full object-contain"
                    />
                  </a>
                ) : isPdfMime(receiptMime) ? (
                  <iframe
                    src={receiptUrl}
                    title={receiptName ?? "Receipt PDF"}
                    className={`
                      border-border bg-muted/20 h-56 w-full max-w-md self-start
                      rounded-md border
                    `}
                  />
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => receiptInputRef.current?.click()}
                disabled={uploading || submitting}
                className="self-start"
              >
                {uploading ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1 size-3.5" />
                )}
                Upload receipt
              </Button>
            )}
            <p className="text-muted-foreground text-[11px]">
              JPG, PNG, WebP, or PDF — up to 10 MB.
            </p>
          </div>
          <div>
            <Label htmlFor="exp-notes">Notes</Label>
            <Textarea
              id="exp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
            className="min-w-28"
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isImageMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

function isPdfMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime === "application/pdf";
}

// Best-effort guess for receipts already saved without a captured
// mime type. Falls back to extension-based detection on the URL.
function guessMimeFromUrl(url: string): string | null {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return null;
}
