"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
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
import type { Entity } from "@/services/entity.service";
import {
  createVendor,
  type CreateVendorInput,
  updateVendor,
  type Vendor,
} from "@/services/vendor.service";

const formSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  name: z.string().min(1, "Name is required").max(500),
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
  addressTh: z.string().max(2000).optional().or(z.literal("")),
  addressEn: z.string().max(2000).optional().or(z.literal("")),
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

// Common contact-type labels accepted by the import. Free-text fallback
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

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      entityId: defaultEntityId ?? "",
      name: "",
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
      addressTh: "",
      addressEn: "",
      zipCode: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (vendor) {
      form.reset({
        entityId: vendor.entityId,
        name: vendor.name,
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
        addressTh: vendor.addressTh ?? "",
        addressEn: vendor.addressEn ?? "",
        zipCode: vendor.zipCode ?? "",
        notes: vendor.notes ?? "",
      });
    } else {
      form.reset({
        entityId: defaultEntityId ?? "",
        name: "",
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
        addressTh: "",
        addressEn: "",
        zipCode: "",
        notes: "",
      });
    }
  }, [open, vendor, defaultEntityId, form]);

  function buildPayload(values: FormValues): CreateVendorInput {
    const creditDaysNum =
      values.creditDays && values.creditDays.trim() !== ""
        ? Number(values.creditDays)
        : undefined;
    return {
      entityId: values.entityId,
      name: values.name,
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
      creditDays: Number.isFinite(creditDaysNum) ? creditDaysNum : undefined,
      addressTh: values.addressTh || undefined,
      addressEn: values.addressEn || undefined,
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
        await createVendor(buildPayload(values));
        toast.success("Vendor created");
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
                Address
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
