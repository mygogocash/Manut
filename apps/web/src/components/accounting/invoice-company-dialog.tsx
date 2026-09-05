"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  getInvoiceCompany,
  type InvoiceCompany,
  updateInvoiceCompany,
} from "@/services/accounting.service";

interface CompanyFormValues {
  name: string;
  /** Multiline — one address line per newline. Mapped to/from `addressLines`. */
  address: string;
  taxId: string;
  email: string;
  tel: string;
  bankName: string;
  bankAccountType: string;
  bankBranch: string;
  bankAccountName: string;
  bankAccountNo: string;
  bankSwift: string;
  footerNote: string;
}

const EMPTY_VALUES: CompanyFormValues = {
  name: "",
  address: "",
  taxId: "",
  email: "",
  tel: "",
  bankName: "",
  bankAccountType: "",
  bankBranch: "",
  bankAccountName: "",
  bankAccountNo: "",
  bankSwift: "",
  footerNote: "",
};

function toFormValues(company: InvoiceCompany): CompanyFormValues {
  return {
    name: company.name ?? "",
    address: (company.addressLines ?? []).join("\n"),
    taxId: company.taxId ?? "",
    email: company.email ?? "",
    tel: company.tel ?? "",
    bankName: company.bankName ?? "",
    bankAccountType: company.bankAccountType ?? "",
    bankBranch: company.bankBranch ?? "",
    bankAccountName: company.bankAccountName ?? "",
    bankAccountNo: company.bankAccountNo ?? "",
    bankSwift: company.bankSwift ?? "",
    footerNote: company.footerNote ?? "",
  };
}

interface InvoiceCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceCompanyDialog({
  open,
  onOpenChange,
}: InvoiceCompanyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CompanyFormValues>({ defaultValues: EMPTY_VALUES });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getInvoiceCompany()
      .then((res) => {
        if (!cancelled) form.reset(toFormValues(res.data));
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load company details";
        toast.error(message);
        form.reset(EMPTY_VALUES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, form]);

  async function onSubmit(values: CompanyFormValues) {
    const payload: InvoiceCompany = {
      name: values.name.trim(),
      addressLines: values.address
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      taxId: values.taxId.trim(),
      email: values.email.trim(),
      tel: values.tel.trim(),
      bankName: values.bankName.trim(),
      bankAccountType: values.bankAccountType.trim(),
      bankBranch: values.bankBranch.trim(),
      bankAccountName: values.bankAccountName.trim(),
      bankAccountNo: values.bankAccountNo.trim(),
      bankSwift: values.bankSwift.trim(),
      footerNote: values.footerNote.trim(),
    };
    try {
      setSubmitting(true);
      await updateInvoiceCompany(payload);
      toast.success("Invoice company details saved");
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to save company details";
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
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>Invoice company details</DialogTitle>
          <DialogDescription>
            These details appear on every generated invoice (PDF, print view,
            and Word).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
              id="invoice-company-form"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company name</FormLabel>
                    <FormControl>
                      <Input placeholder="Company legal name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="One address line per row"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Tax ID" {...field} />
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
                        <Input placeholder="billing@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tel</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="text-muted-foreground text-xs font-medium">
                Bank details
              </p>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank name</FormLabel>
                      <FormControl>
                        <Input placeholder="Bank name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Savings" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankBranch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <FormControl>
                        <Input placeholder="Branch" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account name</FormLabel>
                      <FormControl>
                        <Input placeholder="Account holder name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account number</FormLabel>
                      <FormControl>
                        <Input placeholder="Account number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankSwift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SWIFT / BIC</FormLabel>
                      <FormControl>
                        <Input placeholder="SWIFT / BIC" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="footerNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Footer note</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional note shown at the foot of every invoice"
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
        )}

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
            form="invoice-company-form"
            disabled={submitting || loading}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
