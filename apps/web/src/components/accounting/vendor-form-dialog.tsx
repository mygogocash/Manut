"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
  type ChartOfAccount,
  listAccounts,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";
import {
  createVendor,
  type CreateVendorInput,
  type PaymentTerms,
  type TaxTreatment,
  updateVendor,
  type Vendor,
} from "@/services/vendor.service";

const formSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  name: z.string().min(1, "Name is required").max(500),
  nameTh: z.string().max(500).optional().or(z.literal("")),
  nameEn: z.string().max(500).optional().or(z.literal("")),
  contactType: z.string().max(100).optional().or(z.literal("")),
  contactId: z.string().max(100).optional().or(z.literal("")),
  businessType: z.string().max(100).optional().or(z.literal("")),
  businessLocation: z.string().max(100).optional().or(z.literal("")),
  taxId: z.string().max(40).optional().or(z.literal("")),
  branchCode: z.string().max(30).optional().or(z.literal("")),
  branch: z.string().max(200).optional().or(z.literal("")),
  contactName: z.string().max(200).optional().or(z.literal("")),
  email: z.string().max(320).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  mobile: z.string().max(50).optional().or(z.literal("")),
  creditDays: z.string().optional().or(z.literal("")),
  // Accounting defaults (M1). Selects use a "__none__" sentinel for "unset".
  paymentTerms: z.string().optional().or(z.literal("")),
  taxTreatment: z.string().optional().or(z.literal("")),
  defaultCurrency: z.string().max(10).optional().or(z.literal("")),
  creditLimit: z.string().optional().or(z.literal("")),
  defaultWhtRate: z.string().optional().or(z.literal("")),
  defaultRevenueAccountId: z.string().optional().or(z.literal("")),
  defaultExpenseAccountId: z.string().optional().or(z.literal("")),
  addressTh: z.string().max(2000).optional().or(z.literal("")),
  addressEn: z.string().max(2000).optional().or(z.literal("")),
  deliveryAddressTh: z.string().max(2000).optional().or(z.literal("")),
  deliveryAddressEn: z.string().max(2000).optional().or(z.literal("")),
  zipCode: z.string().max(30).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor | null;
  entities: Entity[];
  /** Default entity for new records — usually the current filter selection. */
  defaultEntityId?: string;
  onSaved: () => void;
}

// Common contact-type labels from HR's source xlsx. Free-text fallback
// stays in scope (the validator allows arbitrary strings), but the
// dropdown covers the buckets the table already filters on so create
// flows don't introduce typos like "Suplier" / "Cleint".
const CONTACT_TYPE_PRESETS = [
  "Supplier",
  "Client",
  "Cash Sale / ขายเงินสด",
  "Employee",
  "Other",
];

const BUSINESS_TYPE_PRESETS = ["Corporation", "Individual", "Partnership"];

// Sentinel Select value for "no default" (SelectItem values can't be empty).
const NONE = "__none__";

const PAYMENT_TERMS_OPTIONS: Array<{ value: PaymentTerms; label: string }> = [
  { value: "cash", label: "Cash / prepaid" },
  { value: "net7", label: "Net 7 days" },
  { value: "net14", label: "Net 14 days" },
  { value: "net30", label: "Net 30 days" },
  { value: "net45", label: "Net 45 days" },
  { value: "net60", label: "Net 60 days" },
  { value: "net90", label: "Net 90 days" },
  { value: "eom", label: "End of month" },
  { value: "custom", label: "Custom (use credit days)" },
];

const TAX_TREATMENT_OPTIONS: Array<{ value: TaxTreatment; label: string }> = [
  { value: "vat7", label: "VAT 7%" },
  { value: "vat0", label: "VAT 0% (zero-rated)" },
  { value: "exempt", label: "VAT exempt" },
];

export function VendorFormDialog({
  open,
  onOpenChange,
  vendor,
  entities,
  defaultEntityId,
  onSaved,
}: VendorFormDialogProps) {
  const isEditing = !!vendor;
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entityId: defaultEntityId ?? "",
      name: "",
      nameTh: "",
      nameEn: "",
      contactType: "",
      contactId: "",
      businessType: "",
      businessLocation: "",
      taxId: "",
      branchCode: "",
      branch: "",
      contactName: "",
      email: "",
      phone: "",
      mobile: "",
      creditDays: "",
      paymentTerms: "",
      taxTreatment: "",
      defaultCurrency: "",
      creditLimit: "",
      defaultWhtRate: "",
      defaultRevenueAccountId: "",
      defaultExpenseAccountId: "",
      addressTh: "",
      addressEn: "",
      deliveryAddressTh: "",
      deliveryAddressEn: "",
      zipCode: "",
      notes: "",
    },
  });

  // Chart-of-accounts option source for the default revenue/expense pickers.
  // Scoped to the currently selected entity so the ids match the vendor's row.
  const selectedEntityId = form.watch("entityId");
  useEffect(() => {
    if (!open || !selectedEntityId) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    listAccounts({ entityId: selectedEntityId })
      .then((res) => {
        if (!cancelled) setAccounts(res.data);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedEntityId]);

  useEffect(() => {
    if (!open) return;
    if (vendor) {
      form.reset({
        entityId: vendor.entityId,
        name: vendor.name,
        nameTh: vendor.nameTh ?? "",
        nameEn: vendor.nameEn ?? "",
        contactType: vendor.contactType ?? "",
        contactId: vendor.contactId ?? "",
        businessType: vendor.businessType ?? "",
        businessLocation: vendor.businessLocation ?? "",
        taxId: vendor.taxId ?? "",
        branchCode: vendor.branchCode ?? "",
        branch: vendor.branch ?? "",
        contactName: vendor.contactName ?? "",
        email: vendor.email ?? "",
        phone: vendor.phone ?? "",
        mobile: vendor.mobile ?? "",
        creditDays: vendor.creditDays !== null ? String(vendor.creditDays) : "",
        paymentTerms: vendor.paymentTerms ?? "",
        taxTreatment: vendor.taxTreatment ?? "",
        defaultCurrency: vendor.defaultCurrency ?? "",
        creditLimit:
          vendor.creditLimit !== null && vendor.creditLimit !== undefined
            ? String(vendor.creditLimit)
            : "",
        defaultWhtRate:
          vendor.defaultWhtRate !== null && vendor.defaultWhtRate !== undefined
            ? String(vendor.defaultWhtRate)
            : "",
        defaultRevenueAccountId: vendor.defaultRevenueAccountId ?? "",
        defaultExpenseAccountId: vendor.defaultExpenseAccountId ?? "",
        addressTh: vendor.addressTh ?? "",
        addressEn: vendor.addressEn ?? "",
        deliveryAddressTh: vendor.deliveryAddressTh ?? "",
        deliveryAddressEn: vendor.deliveryAddressEn ?? "",
        zipCode: vendor.zipCode ?? "",
        notes: vendor.notes ?? "",
      });
    } else {
      form.reset({
        entityId: defaultEntityId ?? "",
        name: "",
        nameTh: "",
        nameEn: "",
        contactType: "",
        contactId: "",
        businessType: "",
        businessLocation: "",
        taxId: "",
        branchCode: "",
        branch: "",
        contactName: "",
        email: "",
        phone: "",
        mobile: "",
        creditDays: "",
        paymentTerms: "",
        taxTreatment: "",
        defaultCurrency: "",
        creditLimit: "",
        defaultWhtRate: "",
        defaultRevenueAccountId: "",
        defaultExpenseAccountId: "",
        addressTh: "",
        addressEn: "",
        deliveryAddressTh: "",
        deliveryAddressEn: "",
        zipCode: "",
        notes: "",
      });
    }
  }, [open, vendor, defaultEntityId, form]);

  function buildPayload(values: FormValues): CreateVendorInput {
    const numOrUndefined = (raw: string | undefined) => {
      if (!raw || raw.trim() === "") return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };
    const selectOrUndefined = (raw: string | undefined) =>
      raw && raw !== NONE ? raw : undefined;
    return {
      entityId: values.entityId,
      name: values.name,
      nameTh: values.nameTh || undefined,
      nameEn: values.nameEn || undefined,
      contactType: values.contactType || undefined,
      contactId: values.contactId || undefined,
      businessType: values.businessType || undefined,
      businessLocation: values.businessLocation || undefined,
      taxId: values.taxId || undefined,
      branchCode: values.branchCode || undefined,
      branch: values.branch || undefined,
      contactName: values.contactName || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      mobile: values.mobile || undefined,
      creditDays: numOrUndefined(values.creditDays),
      paymentTerms: selectOrUndefined(values.paymentTerms) as
        | PaymentTerms
        | undefined,
      taxTreatment: selectOrUndefined(values.taxTreatment) as
        | TaxTreatment
        | undefined,
      defaultCurrency: values.defaultCurrency || undefined,
      creditLimit: numOrUndefined(values.creditLimit),
      defaultWhtRate: numOrUndefined(values.defaultWhtRate),
      defaultRevenueAccountId: selectOrUndefined(values.defaultRevenueAccountId),
      defaultExpenseAccountId: selectOrUndefined(values.defaultExpenseAccountId),
      addressTh: values.addressTh || undefined,
      addressEn: values.addressEn || undefined,
      deliveryAddressTh: values.deliveryAddressTh || undefined,
      deliveryAddressEn: values.deliveryAddressEn || undefined,
      zipCode: values.zipCode || undefined,
      notes: values.notes || undefined,
    };
  }

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      if (isEditing && vendor) {
        await updateVendor(vendor.id, buildPayload(values));
        toast.success("Vendor updated");
      } else {
        const res = await createVendor(buildPayload(values));
        toast.success("Vendor created");
        // Non-blocking close-name warning — the create already succeeded.
        if (res.warning) {
          toast.warning(res.warning.message);
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      toast.error(message);
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
          sm:max-w-3xl
        `}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit vendor" : "New vendor"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${vendor?.name}.`
              : "Create a single vendor / client / supplier. Bulk uploads still go through Import xlsx."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="vendor-form"
          >
            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Identity
              </p>
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
                        disabled={isEditing}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select entity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {entities.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
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
                  name="contactType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact type</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONTACT_TYPE_PRESETS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
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
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Business / Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Co., Ltd." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nameTh"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (TH)</FormLabel>
                      <FormControl>
                        <Input placeholder="ชื่อภาษาไทย" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nameEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (EN)</FormLabel>
                      <FormControl>
                        <Input placeholder="English name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Vendor code from accounting"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID</FormLabel>
                      <FormControl>
                        <Input placeholder="13-digit Thai TIN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business type</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select business type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BUSINESS_TYPE_PRESETS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
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
                  name="businessLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Thailand" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branchCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch code</FormLabel>
                      <FormControl>
                        <Input placeholder="00000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <FormControl>
                        <Input placeholder="Head Office" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Contact
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Primary point of contact"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="contact@vendor.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="02-xxx-xxxx" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile</FormLabel>
                      <FormControl>
                        <Input placeholder="08x-xxx-xxxx" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="creditDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          placeholder="e.g. 30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip / Postal code</FormLabel>
                      <FormControl>
                        <Input placeholder="10110" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Accounting defaults
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment terms</FormLabel>
                      <Select
                        value={field.value || NONE}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {PAYMENT_TERMS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
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
                  name="taxTreatment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax treatment</FormLabel>
                      <Select
                        value={field.value || NONE}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select treatment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {TAX_TREATMENT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
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
                  name="defaultCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default currency</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. THB" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit limit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="e.g. 500000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultWhtRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default WHT rate</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          placeholder="fraction, e.g. 0.03 for 3%"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultRevenueAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default revenue account</FormLabel>
                      <Select
                        value={field.value || NONE}
                        onValueChange={field.onChange}
                        disabled={accounts.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                accounts.length === 0
                                  ? "Select an entity first"
                                  : "Select account"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.code} · {a.name}
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
                  name="defaultExpenseAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default expense account</FormLabel>
                      <Select
                        value={field.value || NONE}
                        onValueChange={field.onChange}
                        disabled={accounts.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                accounts.length === 0
                                  ? "Select an entity first"
                                  : "Select account"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.code} · {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Address
              </p>
              <p className="text-muted-foreground -mt-2 text-[11px]">
                Tax-invoice address. Add a separate delivery address below only
                if goods ship elsewhere.
              </p>
              <FormField
                control={form.control}
                name="addressTh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (TH)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="ที่อยู่ภาษาไทย"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (EN)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="English address"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryAddressTh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery address (TH)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="ที่อยู่จัดส่ง (ถ้าต่างจากที่อยู่ใบกำกับภาษี)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryAddressEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery address (EN)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Delivery address (if different from tax-invoice address)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Notes
              </p>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Internal notes about this vendor…"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </form>
        </Form>

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
            type="submit"
            form="vendor-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
