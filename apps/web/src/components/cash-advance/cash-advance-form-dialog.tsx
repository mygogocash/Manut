"use client";

import { Loader2, Paperclip, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  CASH_ADVANCE_PAYOUT_LABELS,
  CASH_ADVANCE_PAYOUT_MODES,
  type CashAdvancePayoutMode,
  type CashAdvanceRequest,
  createCashAdvance,
  getCashAdvanceItemReceiptUrl,
  updateCashAdvance,
} from "@/services/cash-advance.service";
import {
  type ExpenseCategory,
  listExpenseCategories,
} from "@/services/expense.service";
import { uploadFile } from "@/services/upload.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (req: CashAdvanceRequest) => void;
  defaults?: {
    position?: string | null;
    department?: string | null;
    directManager?: string | null;
    currency?: string;
  };
  editing?: CashAdvanceRequest | null;
}

interface DraftItem {
  // Present only for rows that already exist server-side (edit mode) —
  // lets us mint a signed URL for an attached receipt via its item id.
  id?: string;
  description: string;
  requestedAmount: string;
  categoryId: string;
  receiptUrl: string;
  receiptName: string | null;
}

// Select can't hold an empty value, so a sentinel stands in for "no
// category" and is mapped back to null on save.
const NO_CATEGORY = "none";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

const NEW_ITEM: DraftItem = {
  description: "",
  requestedAmount: "",
  categoryId: "",
  receiptUrl: "",
  receiptName: null,
};

export function CashAdvanceFormDialog({
  open,
  onOpenChange,
  onSaved,
  defaults,
  editing,
}: Props) {
  const isEdit = Boolean(editing);

  const [requestDate, setRequestDate] = useState(todayYmd());
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [directManager, setDirectManager] = useState("");
  const [payoutMode, setPayoutMode] =
    useState<CashAdvancePayoutMode>("bank-transfer");
  const [bankName, setBankName] = useState("");
  const [bankCountry, setBankCountry] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...NEW_ITEM }]);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    listExpenseCategories()
      .then((res) => setCategories(res.data.filter((c) => c.isActive)))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setRequestDate(editing.requestDate);
      setPosition(editing.position ?? "");
      setDepartment(editing.department ?? "");
      setDirectManager(editing.directManager ?? "");
      setPayoutMode(editing.payoutMode);
      setBankName(editing.bankName ?? "");
      setBankCountry(editing.bankCountry ?? "");
      setBankAccountNo(editing.bankAccountNo ?? "");
      setSwiftCode(editing.swiftCode ?? "");
      setCurrency(editing.currency);
      setNotes(editing.notes ?? "");
      setItems(
        editing.items.length > 0
          ? editing.items.map((it) => ({
              id: it.id,
              description: it.description,
              requestedAmount: String(it.requestedAmount),
              categoryId: it.categoryId ?? "",
              receiptUrl: it.receiptUrl ?? "",
              receiptName: it.receiptUrl ? "Attached receipt" : null,
            }))
          : [{ ...NEW_ITEM }],
      );
    } else {
      setRequestDate(todayYmd());
      setPosition(defaults?.position ?? "");
      setDepartment(defaults?.department ?? "");
      setDirectManager(defaults?.directManager ?? "");
      setPayoutMode("bank-transfer");
      setBankName("");
      setBankCountry("");
      setBankAccountNo("");
      setSwiftCode("");
      setCurrency(defaults?.currency ?? "THB");
      setNotes("");
      setItems([{ ...NEW_ITEM }]);
    }
  }, [open, editing, defaults]);

  const total = useMemo(
    () =>
      items.reduce((sum, it) => {
        const n = Number(it.requestedAmount);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0),
    [items],
  );

  function patchItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { ...NEW_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  }

  async function handleReceiptUpload(idx: number, file: File | undefined) {
    if (!file) return;
    try {
      setUploadingIdx(idx);
      const uploaded = await uploadFile(file, {
        bucket: "receipts",
        purpose: "cash-advance-receipt",
      });
      patchItem(idx, {
        receiptUrl: uploaded.url,
        receiptName: uploaded.originalName,
      });
      toast.success("Receipt uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Receipt upload failed");
    } finally {
      setUploadingIdx(null);
    }
  }

  // Open a fresh signed URL for an already-saved row's receipt. Opens the
  // tab synchronously (popup-blocker friendly), then redirects it.
  function viewReceipt(item: DraftItem) {
    if (!editing || !item.id) return;
    const popup = window.open("about:blank", "_blank");
    getCashAdvanceItemReceiptUrl(editing.id, item.id)
      .then((res) => {
        if (popup && !popup.closed) popup.location.href = res.data.url;
        else window.location.href = res.data.url;
      })
      .catch(() => {
        popup?.close();
        toast.error("Could not open receipt");
      });
  }

  async function handleSubmit() {
    const cleaned = items
      .map((it) => ({
        description: it.description.trim(),
        requestedAmount: Number(it.requestedAmount),
        categoryId: it.categoryId || null,
        receiptUrl: it.receiptUrl || null,
      }))
      .filter((it) => it.description && Number.isFinite(it.requestedAmount));

    if (cleaned.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    if (
      payoutMode === "bank-transfer" &&
      (!bankName.trim() || !bankAccountNo.trim())
    ) {
      toast.error("Bank name + account number are required for bank transfer");
      return;
    }

    const payload = {
      entityId: undefined,
      requestDate,
      position: position.trim() || undefined,
      department: department.trim() || undefined,
      directManager: directManager.trim() || undefined,
      payoutMode,
      bankName: bankName.trim() || undefined,
      bankCountry: bankCountry.trim() || undefined,
      bankAccountNo: bankAccountNo.trim() || undefined,
      swiftCode: swiftCode.trim() || undefined,
      currency: currency.trim().toUpperCase() || "THB",
      notes: notes.trim() || undefined,
      items: cleaned,
    };

    try {
      setSubmitting(true);
      const res =
        isEdit && editing
          ? await updateCashAdvance(editing.id, payload)
          : await createCashAdvance(payload);
      toast.success(isEdit ? "Request updated" : "Cash advance request saved");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save request";
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
          flex max-h-[92vh] flex-col overflow-hidden
          sm:max-w-3xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit cash advance" : "New cash advance request"}
          </DialogTitle>
          <DialogDescription>
            Fill in the request details. HR / Finance will review and approve
            each line.
          </DialogDescription>
        </DialogHeader>

        <div className={`-mr-2 flex-1 space-y-4 overflow-y-auto pr-2`}>
          <div
            className={`
              grid grid-cols-1 gap-3
              sm:grid-cols-2
            `}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ca-date">Request Date</Label>
              <FormDatePicker
                value={requestDate}
                onChange={setRequestDate}
                clearable={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ca-position">Position</Label>
              <Input
                id="ca-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. VP — BD"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ca-department">Department</Label>
              <Input
                id="ca-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Sales"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ca-manager">Direct Manager</Label>
              <Input
                id="ca-manager"
                value={directManager}
                onChange={(e) => setDirectManager(e.target.value)}
                placeholder="e.g. Siddharth Sahi"
              />
            </div>
          </div>

          <div
            className={`
              grid grid-cols-1 gap-3
              sm:grid-cols-3
            `}
          >
            <div className="space-y-1.5">
              <Label>Payout Mode</Label>
              <Select
                value={payoutMode}
                onValueChange={(v) => setPayoutMode(v as CashAdvancePayoutMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASH_ADVANCE_PAYOUT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {CASH_ADVANCE_PAYOUT_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ca-currency">Currency</Label>
              <Input
                id="ca-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="THB"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ca-bank-country">Bank Country</Label>
              <Input
                id="ca-bank-country"
                value={bankCountry}
                onChange={(e) => setBankCountry(e.target.value)}
                placeholder="Thailand"
                disabled={payoutMode === "cash"}
              />
            </div>
          </div>

          {payoutMode === "bank-transfer" && (
            <div
              className={`
                grid grid-cols-1 gap-3
                sm:grid-cols-3
              `}
            >
              <div className="space-y-1.5">
                <Label htmlFor="ca-bank-name">Bank Name</Label>
                <Input
                  id="ca-bank-name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ca-bank-account">Bank Account No.</Label>
                <Input
                  id="ca-bank-account"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ca-swift">Swift Code</Label>
                <Input
                  id="ca-swift"
                  value={swiftCode}
                  onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cash Advance Request Details</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="h-7 text-xs"
              >
                <Plus className="mr-1 size-3.5" />
                Add row
              </Button>
            </div>
            <div className="border-border overflow-hidden rounded-md border">
              <div
                className={`
                  bg-muted text-muted-foreground grid
                  grid-cols-[20px_minmax(0,1.3fr)_minmax(0,1fr)_96px_minmax(0,1fr)_28px]
                  gap-2 px-2 py-1.5 text-[11px] font-medium uppercase
                `}
              >
                <span>#</span>
                <span>Description</span>
                <span>Category</span>
                <span className="text-right">Amount</span>
                <span>Receipt</span>
                <span />
              </div>
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className={`
                    grid
                    grid-cols-[20px_minmax(0,1.3fr)_minmax(0,1fr)_96px_minmax(0,1fr)_28px]
                    items-center gap-2 border-t px-2 py-1.5
                  `}
                >
                  <span className="text-muted-foreground text-xs">
                    {idx + 1}
                  </span>
                  <Input
                    value={it.description}
                    onChange={(e) =>
                      patchItem(idx, { description: e.target.value })
                    }
                    placeholder="e.g. Advance salary"
                    className="h-8 text-xs"
                  />
                  <Select
                    value={it.categoryId || NO_CATEGORY}
                    onValueChange={(v) =>
                      patchItem(idx, {
                        categoryId: v === NO_CATEGORY ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={it.requestedAmount}
                    onChange={(e) =>
                      patchItem(idx, { requestedAmount: e.target.value })
                    }
                    placeholder="0.00"
                    className="h-8 text-right text-xs"
                  />
                  {it.receiptName ? (
                    <div className={`flex min-w-0 items-center gap-1 text-xs`}>
                      {it.id && it.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => viewReceipt(it)}
                          className={`
                            min-w-0 truncate text-blue-600
                            hover:underline
                          `}
                          title={it.receiptName}
                        >
                          {it.receiptName}
                        </button>
                      ) : (
                        <span
                          className="min-w-0 truncate"
                          title={it.receiptName}
                        >
                          {it.receiptName}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          patchItem(idx, { receiptUrl: "", receiptName: null })
                        }
                        className={`
                          text-muted-foreground
                          hover:text-destructive
                        `}
                        aria-label="Remove receipt"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`
                        text-muted-foreground flex cursor-pointer items-center
                        gap-1 text-xs
                        hover:text-foreground
                      `}
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf"
                        disabled={uploadingIdx === idx}
                        onChange={(e) =>
                          void handleReceiptUpload(
                            idx,
                            e.target.files?.[0] ?? undefined,
                          )
                        }
                      />
                      {uploadingIdx === idx ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Paperclip className="size-3.5" />
                      )}
                      Upload
                    </label>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`text-destructive size-7`}
                    disabled={items.length <= 1}
                    onClick={() => removeItem(idx)}
                    aria-label="Remove row"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <div
                className={`
                  bg-muted/40 grid
                  grid-cols-[20px_minmax(0,1.3fr)_minmax(0,1fr)_96px_minmax(0,1fr)_28px]
                  gap-2 border-t px-2 py-1.5 text-xs font-semibold
                `}
              >
                <span />
                <span>Total</span>
                <span />
                <span className="text-right tabular-nums">
                  {total.toFixed(2)}
                </span>
                <span className="text-muted-foreground font-normal">
                  {currency}
                </span>
                <span />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-notes">Notes</Label>
            <Textarea
              id="ca-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything HR / Finance should know"
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
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-1 size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Save request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
