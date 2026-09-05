"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormDatePicker } from "@/components/shared/form-date-picker";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
  createInvoice,
  type Invoice,
  type InvoiceInput,
  updateInvoice,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";
import { deleteUpload, uploadFile } from "@/services/upload.service";

const INVOICE_TYPES = ["receivable", "payable"] as const;

/** FileUpload has no prior invoice linkedTo (journals use `journal_entry`). */
const INVOICE_LINKED_TO = "invoice";
const INVOICE_UPLOAD_PURPOSE = "invoice-attachment";
const ATTACHMENT_MAX = 10;
const ATTACHMENT_ACCEPT =
  "application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Qty must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Price must be 0 or more"),
  lineDiscount: z.coerce.number().min(0, "Discount must be 0 or more"),
  vatRate: z.coerce.number().min(0).max(100),
  vatReason: z.string().max(200).optional(),
  capitalised: z.boolean(),
  glAccountId: z.string().optional(),
});

const schema = z
  .object({
    entityId: z.string().min(1, "Entity is required"),
    type: z.enum(INVOICE_TYPES, { required_error: "Type is required" }),
    counterparty: z.string().min(1, "Counterparty is required"),
    billToAddress: z.string().max(2000).optional(),
    reference: z.string().max(200).optional(),
    paymentTerms: z.string().max(200).optional(),
    currency: z.string().min(1, "Currency is required").max(10),
    // Manual FX rate (document currency → THB base), used only for a foreign
    // currency. Blank → the server resolves the issue-date rate.
    exchangeRate: z
      .string()
      .refine(
        (v) => v === "" || Number(v) > 0,
        "Rate must be greater than zero",
      )
      .optional(),
    vatRate: z.coerce.number().min(0, "VAT rate must be 0 or more"),
    taxLabel: z.string().max(50).optional(),
    taxRate: z.coerce
      .number()
      .min(0, "Tax rate must be 0 or more")
      .max(100, "Tax rate must be 100 or less"),
    whtRate: z.coerce.number().min(0, "WHT rate must be 0 or more"),
    headerDiscount: z.coerce.number().min(0, "Discount must be 0 or more"),
    userTotal: z
      .string()
      .refine((v) => v === "" || !Number.isNaN(Number(v)), "Must be a number")
      .optional(),
    issueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Issue date is required"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
    linkedJeId: z.string().optional(),
    notes: z.string().max(2000).optional(),
    lineItems: z
      .array(lineItemSchema)
      .min(1, "At least one line item is required"),
  })
  .refine((data) => data.dueDate >= data.issueDate, {
    message: "Due date must not be before issue date",
    path: ["dueDate"],
  })
  .superRefine((data, ctx) => {
    data.lineItems.forEach((li, i) => {
      if (!isStandardVat(li.vatRate) && !li.vatReason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "VAT reason is required when the rate is not 0% or 7%",
          path: ["lineItems", i, "vatReason"],
        });
      }
    });
    const rawUser = (data.userTotal ?? "").trim();
    if (rawUser === "") return;
    const user = Number(rawUser);
    if (Number.isNaN(user)) return;
    const preview = previewDoc(data.lineItems, data.headerDiscount ?? 0);
    if (Math.abs(user - preview.grandTotal) > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be within 1.00 of the computed total",
        path: ["userTotal"],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

interface SessionUpload {
  id: string;
  name: string;
  url: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isStandardVat(rate: number): boolean {
  return rate === 0 || rate === 7;
}

function isIssuedInvoice(invoice?: Invoice): boolean {
  if (!invoice) return false;
  if (invoice.status === "draft") return false;
  return !invoice.invoiceNo.startsWith("DRAFT-");
}

/** Approximate client preview of computeArDocument. Server is source of truth. */
function previewDoc(
  lines: Array<{
    quantity: number;
    unitPrice: number;
    lineDiscount: number;
    vatRate: number;
  }>,
  headerDiscount: number,
  userTotal?: number,
): {
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  rounding: number;
} {
  const prepared = lines.map((l) => {
    const ext = round2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0));
    const disc = round2(Number(l.lineDiscount) || 0);
    return {
      netBeforeHeader: Math.max(0, round2(ext - disc)),
      vatRate: Number(l.vatRate) || 0,
    };
  });
  const netSum = round2(prepared.reduce((s, l) => s + l.netBeforeHeader, 0));
  const header = Math.min(round2(headerDiscount || 0), netSum);
  let allocated = 0;
  const withHeader = prepared.map((l, i) => {
    let headerShare = 0;
    if (header > 0 && netSum > 0) {
      if (i < prepared.length - 1) {
        headerShare = round2((l.netBeforeHeader / netSum) * header);
        allocated = round2(allocated + headerShare);
      } else {
        headerShare = round2(header - allocated);
      }
    }
    const taxBase = round2(l.netBeforeHeader - headerShare);
    const vatAmount = round2(taxBase * (l.vatRate / 100));
    return { taxBase, vatAmount };
  });
  const subtotal = round2(withHeader.reduce((s, l) => s + l.taxBase, 0));
  const vatTotal = round2(withHeader.reduce((s, l) => s + l.vatAmount, 0));
  let grandTotal = round2(subtotal + vatTotal);
  let rounding = 0;
  if (userTotal !== undefined && !Number.isNaN(userTotal)) {
    rounding = round2(userTotal - grandTotal);
    grandTotal = round2(userTotal);
  }
  return { subtotal, vatTotal, grandTotal, rounding };
}

function emptyLine(vatRate: number): FormValues["lineItems"][number] {
  return {
    description: "",
    quantity: 1,
    unitPrice: 0,
    lineDiscount: 0,
    vatRate,
    vatReason: "",
    capitalised: false,
    glAccountId: "",
  };
}

function toLineDefaults(invoice: Invoice): FormValues["lineItems"][number][] {
  const headerVat = Number(invoice.vatRate) || 0;
  const items = invoice.lineItems.map((li) => ({
    description: li.description,
    quantity: Number(li.quantity),
    unitPrice: Number(li.unitPrice),
    lineDiscount: Number(li.lineDiscount ?? 0),
    vatRate: li.vatRate != null ? Number(li.vatRate) : headerVat,
    vatReason: li.vatReason ?? "",
    capitalised: li.capitalised === true,
    glAccountId: li.glAccountId ?? "",
  }));
  return items.length ? items : [emptyLine(headerVat)];
}

function initialUserTotal(invoice: Invoice): string {
  const rounding = Number(invoice.roundingAmount ?? 0);
  if (!rounding) return "";
  const preview = previewDoc(
    toLineDefaults(invoice),
    Number(invoice.headerDiscount ?? 0),
  );
  return String(round2(preview.grandTotal + rounding));
}

/** Build form defaults — prefilled from `invoice` in edit mode, blank otherwise. */
function toDefaults(invoice?: Invoice): FormValues {
  if (invoice) {
    return {
      entityId: invoice.entity.id,
      type: invoice.type === "payable" ? "payable" : "receivable",
      counterparty: invoice.counterparty,
      billToAddress: invoice.billToAddress ?? "",
      reference: invoice.reference ?? "",
      paymentTerms: invoice.paymentTerms ?? "",
      currency: invoice.currency,
      exchangeRate: "",
      vatRate: Number(invoice.vatRate),
      taxLabel: invoice.taxLabel ?? "",
      taxRate: Number(invoice.taxRate),
      whtRate: Number(invoice.whtRate),
      headerDiscount: Number(invoice.headerDiscount ?? 0),
      userTotal: initialUserTotal(invoice),
      issueDate: invoice.issueDate.slice(0, 10),
      dueDate: invoice.dueDate.slice(0, 10),
      linkedJeId: invoice.linkedJeId ?? "",
      notes: invoice.notes ?? "",
      lineItems: toLineDefaults(invoice),
    };
  }
  return {
    entityId: "",
    type: "receivable",
    counterparty: "",
    billToAddress: "",
    reference: "",
    paymentTerms: "",
    currency: "USD",
    exchangeRate: "",
    vatRate: 0,
    taxLabel: "",
    taxRate: 0,
    whtRate: 0,
    headerDiscount: 0,
    userTotal: "",
    issueDate: todayISO(),
    dueDate: todayISO(),
    linkedJeId: "",
    notes: "",
    lineItems: [emptyLine(0)],
  };
}

function buildInvoiceInput(values: FormValues): InvoiceInput {
  const rawUser = (values.userTotal ?? "").trim();
  return {
    entityId: values.entityId,
    type: values.type,
    counterparty: values.counterparty,
    billToAddress: values.billToAddress?.trim() || undefined,
    reference: values.reference?.trim() || undefined,
    paymentTerms: values.paymentTerms?.trim() || undefined,
    currency: values.currency,
    exchangeRate:
      values.currency.toUpperCase() !== "THB" && values.exchangeRate
        ? Number(values.exchangeRate)
        : undefined,
    vatRate: values.vatRate,
    taxLabel: values.taxLabel?.trim() || undefined,
    taxRate: values.taxRate,
    whtRate: values.whtRate,
    headerDiscount: values.headerDiscount || 0,
    userTotal: rawUser === "" ? undefined : Number(rawUser),
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    linkedJeId: values.linkedJeId?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
    lineItems: values.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      lineDiscount: li.lineDiscount || undefined,
      vatRate: li.vatRate,
      vatReason: li.vatReason?.trim() || undefined,
      capitalised: values.type === "payable" && li.capitalised === true,
      glAccountId: li.glAccountId?.trim() || undefined,
    })),
  };
}

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  onSaved: () => void;
  /** When present the dialog edits this invoice; otherwise it creates a new one. */
  invoice?: Invoice;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  entities,
  onSaved,
  invoice,
}: InvoiceDialogProps) {
  const isEdit = Boolean(invoice);
  const issued = isIssuedInvoice(invoice);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sessionUploads, setSessionUploads] = useState<SessionUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevHeaderVat = useRef(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(invoice),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const issueDateWatch = form.watch("issueDate");
  const dueDateWatch = form.watch("dueDate");
  const currencyWatch = form.watch("currency");
  const typeWatch = form.watch("type");
  const watchedItems = form.watch("lineItems");
  const vatRateNum = Number(form.watch("vatRate")) || 0;
  const taxLabelWatch = (form.watch("taxLabel") ?? "").trim();
  const taxRateNum = Number(form.watch("taxRate")) || 0;
  const whtRateNum = Number(form.watch("whtRate")) || 0;
  const headerDiscountNum = Number(form.watch("headerDiscount")) || 0;
  const userTotalRaw = (form.watch("userTotal") ?? "").trim();
  const userTotalNum = userTotalRaw === "" ? undefined : Number(userTotalRaw);

  const computed = previewDoc(watchedItems ?? [], headerDiscountNum);
  const preview = previewDoc(
    watchedItems ?? [],
    headerDiscountNum,
    userTotalNum !== undefined && !Number.isNaN(userTotalNum)
      ? userTotalNum
      : undefined,
  );
  const extraTax = round2((preview.subtotal * taxRateNum) / 100);
  const whtAmount = round2((preview.subtotal * whtRateNum) / 100);
  const total = round2(preview.grandTotal + extraTax - whtAmount);

  useEffect(() => {
    if (open) {
      const defaults = toDefaults(invoice);
      form.reset(defaults);
      prevHeaderVat.current = Number(defaults.vatRate) || 0;
      setPendingFiles([]);
      setSessionUploads([]);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, invoice, form]);

  useEffect(() => {
    if (!open) return;
    const prev = prevHeaderVat.current;
    if (prev === vatRateNum) return;
    const items = form.getValues("lineItems");
    items.forEach((li, i) => {
      if (Number(li.vatRate) === prev) {
        form.setValue(`lineItems.${i}.vatRate`, vatRateNum);
      }
    });
    prevHeaderVat.current = vatRateNum;
  }, [vatRateNum, form, open]);

  const attachmentCount = pendingFiles.length + sessionUploads.length;

  async function uploadOne(file: File, linkedId: string) {
    return uploadFile(file, {
      bucket: "documents",
      purpose: INVOICE_UPLOAD_PURPOSE,
      linkedTo: INVOICE_LINKED_TO,
      linkedId,
    });
  }

  async function handleFilePick(file: File) {
    if (attachmentCount >= ATTACHMENT_MAX) {
      toast.error(`Maximum ${ATTACHMENT_MAX} attachments`);
      return;
    }
    if (invoice) {
      try {
        setUploading(true);
        const uploaded = await uploadOne(file, invoice.id);
        setSessionUploads((prev) => [
          ...prev,
          {
            id: uploaded.id,
            name: uploaded.originalName,
            url: uploaded.url,
          },
        ]);
        toast.success("Attachment uploaded");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return;
    }
    setPendingFiles((prev) => [...prev, file]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemoveSession(id: string) {
    try {
      await deleteUpload(id);
      setSessionUploads((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove file";
      toast.error(msg);
    }
  }

  async function attachPending(invoiceId: string): Promise<number> {
    let failed = 0;
    for (const file of pendingFiles) {
      try {
        await uploadOne(file, invoiceId);
      } catch {
        failed += 1;
      }
    }
    return failed;
  }

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const input = buildInvoiceInput(values);

      if (invoice) {
        await updateInvoice(invoice.id, input);
        toast.success("Invoice updated");
      } else {
        const created = await createInvoice(input);
        const failed = await attachPending(created.data.id);
        if (failed > 0) {
          toast.error(
            `Draft saved, but ${failed} attachment${failed === 1 ? "" : "s"} failed`,
          );
        } else {
          toast.success("Draft saved");
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : `Failed to ${isEdit ? "update" : "create"} invoice`;
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting && !uploading) onOpenChange(next);
      }}
    >
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-4xl
        `}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Invoice" : "Create draft"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this invoice's details and line items."
              : "Save a receivable or payable draft. The document number is assigned by the server."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="invoice-form"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEdit}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select entity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {entities.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} ({e.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full capitalize">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVOICE_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEdit && invoice ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">
                    {issued ? "Invoice No" : "Draft No"}
                  </span>
                  <Input value={invoice.invoiceNo} readOnly disabled />
                  {invoice.draftNo && invoice.draftNo !== invoice.invoiceNo ? (
                    <p className="text-muted-foreground text-xs">
                      Draft {invoice.draftNo}
                    </p>
                  ) : issued ? null : (
                    <p className="text-muted-foreground text-xs">
                      System-assigned. Statutory INV/EXP number is issued on
                      send.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Invoice No</span>
                  <p className="text-muted-foreground text-xs">
                    System-assigned on save (DRAFT-INV). Statutory INV/EXP
                    number is issued on send.
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="counterparty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Counterparty *</FormLabel>
                    <FormControl>
                      <Input placeholder="Company or person name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <FormControl>
                      <Input placeholder="USD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {currencyWatch.toUpperCase() !== "THB" ? (
                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate → THB</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.00000001"
                          min="0"
                          placeholder="Auto (issue-date rate)"
                          {...field}
                        />
                      </FormControl>
                      {invoice?.fxRateDate ? (
                        <FormDescription>
                          FX {invoice.fxSide ?? "rate"} date{" "}
                          {invoice.fxRateDate.slice(0, 10)}
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : invoice?.fxRateDate ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">FX rate date</span>
                  <p className="text-muted-foreground text-xs">
                    {invoice.fxSide ? `${invoice.fxSide} · ` : ""}
                    {invoice.fxRateDate.slice(0, 10)}
                  </p>
                </div>
              ) : null}

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PO number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date *</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        {...field}
                        maxDate={dueDateWatch || undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date *</FormLabel>
                    <FormControl>
                      <FormDatePicker
                        {...field}
                        minDate={issueDateWatch || undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vatRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Default for new lines. Per-line rate can override.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. GST" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whtRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WHT Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="headerDiscount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Header discount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userTotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document total (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={`Computed ${fmt(computed.grandTotal)}`}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Satang tweak within 1.00 of the computed VAT-inclusive
                      total. Server computeArDocument is the source of truth.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Net 45 days" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billToAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill To Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Counterparty billing address"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Line Items
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => append(emptyLine(vatRateNum))}
                >
                  <Plus className="mr-1 size-3" />
                  Add Line
                </Button>
              </div>

              <div
                className={`
                  border-border divide-border divide-y rounded-lg border
                `}
              >
                <div
                  className={`
                    bg-surface-secondary text-muted-foreground grid
                    grid-cols-[1fr_72px_96px_96px_96px_32px] gap-2 px-3 py-2
                    text-[9px] font-bold tracking-widest uppercase
                  `}
                >
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit Price</span>
                  <span>Discount</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>

                {fields.map((field, index) => {
                  const row = watchedItems?.[index];
                  const lineAmount = round2(
                    (Number(row?.quantity) || 0) *
                      (Number(row?.unitPrice) || 0) -
                      (Number(row?.lineDiscount) || 0),
                  );
                  const lineVat = Number(row?.vatRate) || 0;
                  return (
                    <div
                      key={field.id}
                      className="flex flex-col gap-2 px-3 py-2"
                    >
                      <div
                        className={`
                          grid grid-cols-[1fr_72px_96px_96px_96px_32px]
                          items-start gap-2
                        `}
                      >
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.description`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Item description"
                                  className="h-8 text-xs"
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.quantity`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="h-8 text-xs"
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.unitPrice`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="h-8 text-xs"
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.lineDiscount`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="h-8 text-xs"
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <span
                          className={`
                            flex h-8 items-center justify-end text-xs
                            tabular-nums
                          `}
                        >
                          {fmt(lineAmount)}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={fields.length <= 1}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      <div
                        className={`
                          grid grid-cols-[88px_1fr_auto] items-start gap-2
                        `}
                      >
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.vatRate`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  className="h-8 text-xs"
                                  aria-label="Line VAT rate"
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.vatReason`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder={
                                    isStandardVat(lineVat)
                                      ? "VAT reason (if not 0% or 7%)"
                                      : "VAT reason required"
                                  }
                                  className="h-8 text-xs"
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {typeWatch === "payable" ? (
                          <FormField
                            control={form.control}
                            name={`lineItems.${index}.capitalised`}
                            render={({ field: f }) => (
                              <FormItem
                                className={`
                                  flex h-8 items-center gap-2 space-y-0
                                `}
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={f.value}
                                    onCheckedChange={(v) =>
                                      f.onChange(v === true)
                                    }
                                  />
                                </FormControl>
                                <FormLabel className="text-xs font-normal">
                                  Capitalised
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {form.formState.errors.lineItems?.root && (
                <p className="text-destructive text-xs">
                  {form.formState.errors.lineItems.root.message}
                </p>
              )}
            </div>

            <div
              className={`
                border-border bg-surface-secondary flex flex-col gap-1.5
                rounded-lg border p-3 text-sm
              `}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {fmt(preview.subtotal)} {currencyWatch}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">VAT</span>
                <span className="tabular-nums">{fmt(preview.vatTotal)}</span>
              </div>
              {(taxLabelWatch !== "" || taxRateNum > 0) && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {taxLabelWatch || "Tax"} ({taxRateNum}%)
                  </span>
                  <span className="tabular-nums">{fmt(extraTax)}</span>
                </div>
              )}
              {preview.rounding !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rounding</span>
                  <span className="tabular-nums">
                    {preview.rounding > 0 ? "+" : ""}
                    {fmt(preview.rounding)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Grand total</span>
                <span className="tabular-nums">
                  {fmt(preview.grandTotal)} {currencyWatch}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  WHT ({whtRateNum}%)
                </span>
                <span className="text-destructive tabular-nums">
                  −{fmt(whtAmount)}
                </span>
              </div>
              <div
                className={`
                  border-border mt-1 flex items-center justify-between border-t
                  pt-2 font-semibold
                `}
              >
                <span>Total Due</span>
                <span className="tabular-nums">
                  {fmt(total)} {currencyWatch}
                </span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Preview only. Posted amounts come from the server.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Attachments
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFilePick(f);
                }}
              />
              {sessionUploads.map((file) => (
                <div
                  key={file.id}
                  className={`
                    border-border bg-card flex items-center justify-between
                    gap-2 rounded-md border p-2.5 text-sm
                  `}
                >
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      text-primary inline-flex min-w-0 items-center gap-1
                      truncate
                      hover:underline
                    `}
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={submitting || uploading}
                    onClick={() => void handleRemoveSession(file.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              {pendingFiles.map((file, i) => (
                <div
                  key={`${file.name}-${file.size}-${i}`}
                  className={`
                    border-border bg-card flex items-center justify-between
                    gap-2 rounded-md border p-2.5 text-sm
                  `}
                >
                  <span className="truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={submitting}
                    onClick={() =>
                      setPendingFiles((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                disabled={
                  uploading || submitting || attachmentCount >= ATTACHMENT_MAX
                }
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                {uploading ? "Uploading…" : "Attach file"}
              </Button>
              <p className="text-muted-foreground text-xs">
                PDF, image, Word, or Excel. Linked as {INVOICE_LINKED_TO} after
                the draft exists. Existing files are not listed here.
              </p>
            </div>

            <FormField
              control={form.control}
              name="linkedJeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Journal Entry ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional journal entry ID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting || uploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="invoice-form"
            disabled={submitting || uploading}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
