"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/shared/badge";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { Button } from "@/components/ui/button";
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
import { ApiError } from "@/lib/api-client";
import {
  activateCompany,
  type CompanySetup,
  getCompanySetup,
  REPORTING_CURRENCY,
  updateCompanySetup,
  VAT_REGISTRATION_STATUSES,
} from "@/services/accounting.service";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const UNSET = "__unset__";

const schema = z.object({
  nameTh: z.string().max(300).optional(),
  branchCode: z.string().max(20).optional(),
  logoUrl: z.string().max(2000).optional(),
  vatRegistrationStatus: z.string().optional(),
  boiType: z.string().max(100).optional(),
  boiPeriod: z.string().max(100).optional(),
  fiscalYearStartMonth: z.string().optional(),
  firstFiscalYearStart: z.string().optional(),
  firstFiscalYearEnd: z.string().optional(),
  enabledCurrencies: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toDefaults(c: CompanySetup | null): FormValues {
  return {
    nameTh: c?.nameTh ?? "",
    branchCode: c?.branchCode ?? "",
    logoUrl: c?.logoUrl ?? "",
    vatRegistrationStatus: c?.vatRegistrationStatus ?? "",
    boiType: c?.boiType ?? "",
    boiPeriod: c?.boiPeriod ?? "",
    fiscalYearStartMonth:
      typeof c?.fiscalYearStartMonth === "number"
        ? String(c.fiscalYearStartMonth)
        : "",
    firstFiscalYearStart: c?.firstFiscalYearStart?.slice(0, 10) ?? "",
    firstFiscalYearEnd: c?.firstFiscalYearEnd?.slice(0, 10) ?? "",
    enabledCurrencies: (c?.enabledCurrencies ?? []).join(", "),
  };
}

interface CompanySetupFormProps {
  entityId: string;
  canAdmin: boolean;
  onChanged?: () => void;
}

export function CompanySetupForm({
  entityId,
  canAdmin,
  onChanged,
}: CompanySetupFormProps) {
  const [company, setCompany] = useState<CompanySetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(null),
  });

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await getCompanySetup(entityId);
      setCompany(res.data);
      form.reset(toDefaults(res.data));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load company setup";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityId, form]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(values: FormValues) {
    try {
      setSaving(true);
      // Only submit currencies when the field is non-empty; always keep the
      // reporting currency in the list so the server's THB check passes.
      const currencies = (values.enabledCurrencies ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const enabledCurrencies = currencies.length
        ? Array.from(new Set([REPORTING_CURRENCY, ...currencies]))
        : undefined;

      const vat = values.vatRegistrationStatus?.trim();

      await updateCompanySetup({
        entityId,
        nameTh: values.nameTh?.trim() || null,
        branchCode: values.branchCode?.trim() || null,
        logoUrl: values.logoUrl?.trim() || null,
        vatRegistrationStatus: vat
          ? (vat as "registered" | "not_registered" | "exempt")
          : null,
        boiType: values.boiType?.trim() || null,
        boiPeriod: values.boiPeriod?.trim() || null,
        fiscalYearStartMonth: values.fiscalYearStartMonth
          ? Number(values.fiscalYearStartMonth)
          : undefined,
        firstFiscalYearStart: values.firstFiscalYearStart || null,
        firstFiscalYearEnd: values.firstFiscalYearEnd || null,
        enabledCurrencies,
      });
      toast.success("Company profile saved");
      onChanged?.();
      await load();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save company setup";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onActivate() {
    try {
      setActivating(true);
      const res = await activateCompany(entityId);
      toast.success(
        res.data.activated
          ? "Company activated"
          : "Company is already active",
      );
      onChanged?.();
      await load();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to activate company";
      toast.error(msg);
    } finally {
      setActivating(false);
    }
  }

  const isActive = company?.setupState === "active";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={isActive ? "active" : "draft"}>
          {isActive ? "Active" : "Setup"}
        </Badge>
        {company ? (
          <span className="text-muted-foreground text-xs">
            {company.name} ({company.code})
          </span>
        ) : null}
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          id="company-setup-form"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              control={form.control}
              name="nameTh"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name (Thai)</FormLabel>
                  <FormControl>
                    <Input lang="th" disabled={!canAdmin} {...field} />
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
                  <FormLabel>Branch Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="00000 = head office"
                      disabled={!canAdmin}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fiscalYearStartMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fiscal Year Start Month</FormLabel>
                  <Select
                    value={field.value || UNSET}
                    onValueChange={(v) =>
                      field.onChange(v === UNSET ? "" : v)
                    }
                    disabled={!canAdmin}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNSET}>— Not set —</SelectItem>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
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
              name="vatRegistrationStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>VAT Registration</FormLabel>
                  <Select
                    value={field.value || UNSET}
                    onValueChange={(v) =>
                      field.onChange(v === UNSET ? "" : v)
                    }
                    disabled={!canAdmin}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNSET}>— Not set —</SelectItem>
                      {VAT_REGISTRATION_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace("_", " ")}
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
              name="firstFiscalYearStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Fiscal Year — Start</FormLabel>
                  <FormControl>
                    <FormDatePicker {...field} disabled={!canAdmin} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firstFiscalYearEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Fiscal Year — End</FormLabel>
                  <FormControl>
                    <FormDatePicker {...field} disabled={!canAdmin} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="boiType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BOI Type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Category A"
                      disabled={!canAdmin}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="boiPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BOI Period</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 8 years"
                      disabled={!canAdmin}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://…"
                      disabled={!canAdmin}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="enabledCurrencies"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Enabled Currencies</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="THB, USD, EUR"
                      disabled={!canAdmin}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    Comma-separated. {REPORTING_CURRENCY} (reporting currency) is
                    always kept.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {canAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                form="company-setup-form"
                disabled={saving || loading}
                className="min-w-28"
              >
                {saving ? (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                ) : null}
                Save Profile
              </Button>
              {!isActive ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onActivate}
                  disabled={activating || loading}
                >
                  {activating ? (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 size-3.5" />
                  )}
                  Activate Company
                </Button>
              ) : null}
            </div>
          ) : null}
        </form>
      </Form>
    </div>
  );
}
