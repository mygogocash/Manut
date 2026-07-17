"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormDatePicker } from "@/components/shared/form-date-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { CRM_ACCOUNT_REGIONS, CRM_ALL_COUNTRIES } from "@/constants/crm-geo";
import { ApiError } from "@/lib/api-client";
import {
  type Account,
  createAccount,
  type CreateAccountInput,
  updateAccount,
} from "@/services/revenue-account.service";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
  STAGE_PROBABILITY_DEFAULTS,
} from "@/services/revenue-opportunity.service";

// Date helpers — pickers send "" for unset, server converts to null.
const dateOrEmpty = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.literal(""));

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  domain: z.string().max(255).optional().or(z.literal("")),
  industry: z.string().max(150).optional().or(z.literal("")),
  size: z.string().max(50).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  region: z.string().max(100).optional().or(z.literal("")),
  website: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
  totalUsers: z.string().optional().or(z.literal("")),
  appUsers: z.string().optional().or(z.literal("")),
  // BD round 3 — engagement tracking
  picName: z.string().max(200).optional().or(z.literal("")),
  designation: z.string().max(150).optional().or(z.literal("")),
  department: z.string().max(150).optional().or(z.literal("")),
  lastFollowUpDate: dateOrEmpty.optional(),
  agreementSignedDate: dateOrEmpty.optional(),
  // "engagement" / "revenue" — UI dropdown, server takes any string
  engagementType: z.string().max(40).optional().or(z.literal("")),
  uatStartDate: dateOrEmpty.optional(),
  uatEndDate: dateOrEmpty.optional(),
  blocker: z.string().max(2000).optional().or(z.literal("")),
  remarks: z.string().max(2000).optional().or(z.literal("")),
  // Pipeline sync — saved to linked Opportunity (bidirectional with Pipeline tab).
  dealOpportunityId: z.string().optional().or(z.literal("")),
  dealStage: z.enum(OPPORTUNITY_STAGES),
  dealProbability: z.string().optional().or(z.literal("")),
  dealLaunchDate: dateOrEmpty.optional(),
  dealRevenueLaunchDate: dateOrEmpty.optional(),
  dealValue: z.string().optional().or(z.literal("")),
  dealCurrency: z.string().length(3),
});

type FormValues = z.infer<typeof formSchema>;

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  /**
   * Fires after create / update succeeds. The freshly persisted account is
   * forwarded so callers (e.g. the Opportunity form's inline create flow)
   * can chain a follow-up action without re-fetching.
   */
  onSaved: (account?: Account) => void;
  /** Optional initial value for `name`, used by inline-create entry points. */
  initialName?: string;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSaved,
  initialName,
}: AccountFormDialogProps) {
  const isEditing = !!account;
  const [submitting, setSubmitting] = useState(false);
  // The form's country
  // picker was still on the curated shortlist + opportunity-derived
  // merge, so Morocco / Laos / Qatar / etc. were missing. Switched
  // to the full ISO 3166-1 list (CRM_ALL_COUNTRIES, 249 entries).
  const [countryOptions, setCountryOptions] = useState<string[]>([
    ...CRM_ALL_COUNTRIES,
  ]);

  // When account-name dedupe trips a 409 on create, prompt
  // the rep before sending a second request with confirmCreate=true.
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      name: "",
      domain: "",
      industry: "",
      size: "",
      country: "",
      region: "",
      website: "",
      notes: "",
      totalUsers: "",
      appUsers: "",
      picName: "",
      designation: "",
      department: "",
      lastFollowUpDate: "",
      agreementSignedDate: "",
      engagementType: "",
      uatStartDate: "",
      uatEndDate: "",
      blocker: "",
      remarks: "",
      dealOpportunityId: "",
      dealStage: "qualified",
      dealProbability: "20",
      dealLaunchDate: "",
      dealRevenueLaunchDate: "",
      dealValue: "0",
      dealCurrency: "USD",
    },
  });

  // CRM_ALL_COUNTRIES is computed once at module load, so no dynamic
  // fetch is needed. Kept the open-keyed effect shape in case future
  // sources (e.g. tenant-custom subdivision lists) need to merge in.
  useEffect(() => {
    if (!open) return;
    setCountryOptions([...CRM_ALL_COUNTRIES]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (account) {
      const opp = account.opportunities[0];
      form.reset({
        name: account.name,
        domain: account.domain ?? "",
        industry: account.industry ?? "",
        size: account.size ?? "",
        country: account.country ?? "",
        region: account.region ?? "",
        website: account.website ?? "",
        notes: account.notes ?? "",
        totalUsers:
          account.totalUsers !== null ? String(account.totalUsers) : "",
        appUsers: account.appUsers !== null ? String(account.appUsers) : "",
        picName: account.picName ?? "",
        designation: account.designation ?? "",
        department: account.department ?? "",
        lastFollowUpDate: account.lastFollowUpDate?.slice(0, 10) ?? "",
        agreementSignedDate: account.agreementSignedDate?.slice(0, 10) ?? "",
        engagementType: account.engagementType ?? "",
        uatStartDate: account.uatStartDate?.slice(0, 10) ?? "",
        uatEndDate: account.uatEndDate?.slice(0, 10) ?? "",
        blocker: account.blocker ?? "",
        remarks: account.remarks ?? "",
        dealOpportunityId: opp?.id ?? "",
        dealStage: (opp?.stage as OpportunityStage) ?? "qualified",
        dealProbability: opp ? String(opp.probability) : "20",
        dealLaunchDate: opp?.launchDate?.slice(0, 10) ?? "",
        dealRevenueLaunchDate: opp?.revenueLaunchDate?.slice(0, 10) ?? "",
        dealValue: opp ? String(opp.value) : "0",
        dealCurrency: opp?.currency ?? "USD",
      });
    } else {
      form.reset({
        name: initialName ?? "",
        domain: "",
        industry: "",
        size: "",
        country: "",
        region: "",
        website: "",
        notes: "",
        totalUsers: "",
        appUsers: "",
        picName: "",
        designation: "",
        department: "",
        lastFollowUpDate: "",
        agreementSignedDate: "",
        engagementType: "",
        uatStartDate: "",
        uatEndDate: "",
        blocker: "",
        remarks: "",
        dealOpportunityId: "",
        dealStage: "qualified",
        dealProbability: "20",
        dealLaunchDate: "",
        dealRevenueLaunchDate: "",
        dealValue: "0",
        dealCurrency: "USD",
      });
    }
    setPendingValues(null);
    setConfirmOpen(false);
    setConflictMessage(null);
  }, [open, account, initialName, form]);

  function buildPayload(
    values: FormValues,
    confirmCreate: boolean,
  ): CreateAccountInput {
    const totalUsersNum =
      values.totalUsers && values.totalUsers.trim() !== ""
        ? Number(values.totalUsers)
        : undefined;
    const appUsersNum =
      values.appUsers && values.appUsers.trim() !== ""
        ? Number(values.appUsers)
        : undefined;
    // Empty string sent for engagement fields too. The server normalises
    // "" → null on persist; the client just forwards the empty string
    // so update-paths recognise the "clear" intent (vs `undefined`
    // which leaves the field untouched on edit).
    return {
      name: values.name,
      domain: values.domain || undefined,
      industry: values.industry || undefined,
      size: values.size || undefined,
      country: values.country || undefined,
      region: values.region || undefined,
      website: values.website || undefined,
      notes: values.notes || undefined,
      totalUsers: Number.isFinite(totalUsersNum) ? totalUsersNum : undefined,
      appUsers: Number.isFinite(appUsersNum) ? appUsersNum : undefined,
      picName: values.picName ?? "",
      designation: values.designation ?? "",
      department: values.department ?? "",
      lastFollowUpDate: values.lastFollowUpDate ?? "",
      agreementSignedDate: values.agreementSignedDate ?? "",
      engagementType: values.engagementType ?? "",
      uatStartDate: values.uatStartDate ?? "",
      uatEndDate: values.uatEndDate ?? "",
      blocker: values.blocker ?? "",
      remarks: values.remarks ?? "",
      ...(confirmCreate && { confirmCreate: true }),
      deal: {
        ...(values.dealOpportunityId
          ? { opportunityId: values.dealOpportunityId }
          : {}),
        stage: values.dealStage,
        probability:
          (values.dealProbability ?? "").trim() !== ""
            ? Number(values.dealProbability)
            : STAGE_PROBABILITY_DEFAULTS[values.dealStage],
        launchDate: values.dealLaunchDate ?? "",
        revenueLaunchDate: values.dealRevenueLaunchDate ?? "",
        value: Number(values.dealValue) || 0,
        currency: values.dealCurrency,
      },
    };
  }

  function regionOptions(current: string | undefined): string[] {
    const base = [...CRM_ACCOUNT_REGIONS];
    if (
      current &&
      !base.includes(current as (typeof CRM_ACCOUNT_REGIONS)[number])
    ) {
      return [current, ...base];
    }
    return base;
  }

  function countryOptionsFor(current: string | undefined): string[] {
    if (current && !countryOptions.includes(current)) {
      return [current, ...countryOptions];
    }
    return countryOptions;
  }

  async function send(values: FormValues, confirmCreate: boolean) {
    try {
      setSubmitting(true);
      let saved: Account | undefined;
      if (isEditing && account) {
        const res = await updateAccount(
          account.id,
          buildPayload(values, false),
        );
        saved = res.data;
        toast.success("Account updated");
      } else {
        const res = await createAccount(buildPayload(values, confirmCreate));
        saved = res.data;
        toast.success("Account created");
      }

      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      // 409 only fires on create when the name fallback hits a
      // duplicate. Update returns 409 only on domain collision, where
      // confirmCreate doesn't apply — surface the error instead.
      if (
        !isEditing &&
        err instanceof ApiError &&
        err.status === 409 &&
        !confirmCreate
      ) {
        setPendingValues(values);
        setConflictMessage(err.message);
        setConfirmOpen(true);
        return;
      }
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

  async function handleConfirmDuplicate() {
    if (!pendingValues) return;
    setConfirmOpen(false);
    await send(pendingValues, true);
    setPendingValues(null);
    setConflictMessage(null);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!submitting) onOpenChange(next);
        }}
      >
        <DialogContent
          className={`
            max-h-[92vh] overflow-y-auto
            sm:max-w-2xl
          `}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit account" : "New account"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? `Update details for ${account?.name}.`
                : "Create a sales account. Domain is the primary dedupe key — if a name match exists you'll be prompted to confirm."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => send(v, false))}
              className="flex flex-col gap-5"
              id="account-form"
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
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Acme Corp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="domain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Domain</FormLabel>
                        <FormControl>
                          <Input placeholder="acme.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://acme.com" {...field} />
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
                  Profile
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. SaaS, Fintech" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 51-200" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countryOptionsFor(field.value).map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
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
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {regionOptions(field.value).map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
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
                    name="totalUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total users</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            placeholder="e.g. 12500"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="appUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App users</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            placeholder="e.g. 3400"
                            {...field}
                          />
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
                  Engagement & follow-up
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="picName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PIC name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Person in charge at the partner"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="designation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Designation</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. CTO" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Product" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="engagementType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(v) => field.onChange(v)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Engagement / Revenue" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="engagement">
                              Engagement
                            </SelectItem>
                            <SelectItem value="revenue">Revenue</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastFollowUpDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last follow-up date</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="agreementSignedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agreement signed date</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="uatStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UAT start date</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="uatEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UAT end date</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="blocker"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Blocker</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Anything blocking this deal moving forward…"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Remarks</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Other notes about this engagement…"
                            {...field}
                          />
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
                  Pipeline (synced with Pipeline tab)
                </p>
                <p className="text-muted-foreground text-xs">
                  Stage, probability, TCV, and launch date are saved to the
                  linked opportunity and appear on the Pipeline board.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="dealStage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            const prob =
                              STAGE_PROBABILITY_DEFAULTS[v as OpportunityStage];
                            form.setValue("dealProbability", String(prob));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {OPPORTUNITY_STAGES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {OPPORTUNITY_STAGE_LABELS[s]}
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
                    name="dealProbability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Probability (%)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={100} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dealValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TCV</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dealCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <FormControl>
                          <Input
                            maxLength={3}
                            className="uppercase"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value.toUpperCase())
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dealLaunchDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Launch date</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dealRevenueLaunchDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revenue launch date</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
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
                  Notes
                </p>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Internal notes about this account…"
                          rows={3}
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
              form="account-form"
              disabled={submitting}
              className="min-w-32"
            >
              {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              {isEditing ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account name already exists</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictMessage ?? "An account with this name already exists."}{" "}
              Create a separate account anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDuplicate}
              disabled={submitting}
            >
              Create new anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
