"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { RemoteUserPicker } from "@/components/crm/remote-user-picker";
import { RemoteAccountPicker } from "@/components/sales-revenue/remote-account-picker";
import { RemoteContactPicker } from "@/components/sales-revenue/remote-contact-picker";
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
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  convertLead,
  type ConvertLeadInput,
  type Lead,
} from "@/services/revenue-lead.service";
import {
  CONVERT_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  STAGE_PROBABILITY_DEFAULTS,
} from "@/services/revenue-opportunity.service";

const formSchema = z
  .object({
    name: z.string().min(1, "Opportunity name is required").max(300),
    stage: z.enum(["qualified", "proposal", "negotiation"]),
    value: z.string().min(1, "Value is required"),
    currency: z.string().length(3, "Use a 3-letter currency code"),
    probability: z.string().optional().or(z.literal("")),
    closeDate: z.string().optional().or(z.literal("")),
    type: z.string().max(100).optional().or(z.literal("")),
    accountMode: z.enum(["new", "existing"]),
    accountId: z.string().optional(),
    contactMode: z.enum(["lead", "existing"]),
    contactId: z.string().optional(),
    // Only used when caller has crm:reassign. Empty string =
    // keep lead.ownerId; concrete uuid = override.
    ownerId: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.accountMode === "existing" && !d.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountId"],
        message: "Pick an existing account.",
      });
    }
    if (d.contactMode === "existing" && !d.contactId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactId"],
        message: "Pick an existing contact.",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

interface ConvertLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onDone: () => void;
}

export function ConvertLeadDialog({
  open,
  onOpenChange,
  lead,
  onDone,
}: ConvertLeadDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  // When account-name dedupe trips a 409, prompt the rep
  // before sending a second request with confirmCreate=true.
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const { hasPermission } = useAuth();
  const canReassign = hasPermission("sales-revenue:reassign");

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      name: "",
      stage: "qualified",
      value: "",
      currency: "USD",
      probability: "",
      closeDate: "",
      type: "",
      accountMode: "new",
      accountId: "",
      contactMode: "lead",
      contactId: "",
      ownerId: "",
    },
  });

  const accountMode = form.watch("accountMode");
  const accountId = form.watch("accountId");
  const contactMode = form.watch("contactMode");

  useEffect(() => {
    if (!open || !lead) return;
    form.reset({
      name: `${lead.company} — Opportunity`,
      stage: "qualified",
      value: "",
      currency: "USD",
      probability: "",
      closeDate: "",
      type: "",
      accountMode: "new",
      accountId: "",
      contactMode: "lead",
      contactId: "",
      ownerId: "",
    });
    setPendingValues(null);
    setConfirmOpen(false);
    setConflictMessage(null);
  }, [open, lead, form]);

  // Switching to "new account" wipes any existing-contact selection so we
  // don't ship a stale `contactId` that doesn't belong to the new account.
  useEffect(() => {
    if (accountMode === "new") {
      form.setValue("contactMode", "lead");
      form.setValue("contactId", "");
    }
  }, [accountMode, form]);

  function buildPayload(
    values: FormValues,
    confirmCreate: boolean,
  ): ConvertLeadInput {
    const opportunity: ConvertLeadInput["opportunity"] = {
      name: values.name,
      stage: values.stage,
      value: Number(values.value),
      currency: values.currency.toUpperCase(),
      probability: values.probability ? Number(values.probability) : undefined,
      closeDate: values.closeDate || undefined,
      type: values.type || undefined,
    };
    return {
      opportunity,
      ...(values.accountMode === "existing" &&
        values.accountId && { accountId: values.accountId }),
      ...(values.contactMode === "existing" &&
        values.contactId && { contactId: values.contactId }),
      // Only forward ownerId when the rep actually picked a different owner.
      // Sending the lead's own owner would make the reassignment guard reject the
      // request for crm:reassign-less callers; for crm:reassign callers it's
      // still cleaner to omit unless they meant to change.
      ...(canReassign &&
        values.ownerId &&
        values.ownerId !== lead?.ownerId && { ownerId: values.ownerId }),
      ...(confirmCreate && { confirmCreate: true }),
    };
  }

  async function send(values: FormValues, confirmCreate: boolean) {
    if (!lead) return;
    try {
      setSubmitting(true);
      await convertLead(lead.id, buildPayload(values, confirmCreate));
      toast.success("Lead converted");
      onDone();
      onOpenChange(false);
    } catch (err) {
      // 409 fires only on the name-fallback path (new account).
      // Existing-account path doesn't trip dedupe.
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        !confirmCreate &&
        values.accountMode === "new"
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
            : "Failed to convert lead";
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
            <DialogTitle>Convert lead to opportunity</DialogTitle>
            <DialogDescription>
              {lead
                ? `Promote ${lead.firstName} ${lead.lastName} at ${lead.company} into a full Account / Contact / Opportunity. The lead row stays as an audit record.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => send(v, false))}
              className="flex flex-col gap-5"
              id="convert-lead-form"
            >
              <section className="flex flex-col gap-3">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Opportunity
                </p>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Acme — Platform Q3"
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
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CONVERT_STAGES.map((s) => (
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
                    name="probability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Probability (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder={String(
                              STAGE_PROBABILITY_DEFAULTS[form.watch("stage")] ??
                                "",
                            )}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Leave blank to snap to the stage default.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
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
                          <Input
                            maxLength={3}
                            placeholder="USD"
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
                    name="closeDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected close date</FormLabel>
                        <FormControl>
                          <FormDatePicker {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. SaaS, Services" {...field} />
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
                  Account
                </p>
                <FormField
                  control={form.control}
                  name="accountMode"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">
                            Create new from {lead?.company ?? "lead company"}
                          </SelectItem>
                          <SelectItem value="existing">
                            Attach to an existing account
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {accountMode === "existing" ? (
                  <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RemoteAccountPicker
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder="Search accounts…"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
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
                <FormField
                  control={form.control}
                  name="contactMode"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={accountMode === "new"}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="lead">
                            Create new from{" "}
                            {lead
                              ? `${lead.firstName} ${lead.lastName}`
                              : "lead contact"}
                          </SelectItem>
                          <SelectItem value="existing">
                            Attach an existing contact on this account
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {accountMode === "new" ? (
                        <FormDescription>
                          Existing-contact picker activates once you switch the
                          account selector to an existing account.
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {accountMode === "existing" && contactMode === "existing" ? (
                  <FormField
                    control={form.control}
                    name="contactId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RemoteContactPicker
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            accountId={accountId ?? ""}
                            placeholder="Search contacts…"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </section>

              {canReassign ? (
                <section className="flex flex-col gap-3">
                  <p
                    className={`
                      text-muted-foreground text-[10px] font-bold
                      tracking-widest uppercase
                    `}
                  >
                    Owner
                  </p>
                  <FormField
                    control={form.control}
                    name="ownerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RemoteUserPicker
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            placeholder={`Keep ${lead?.owner?.name ?? "lead owner"}`}
                          />
                        </FormControl>
                        <FormDescription>
                          Leave blank to keep the lead owner. Picking another
                          rep flips ownership on the new Account / Contact /
                          Opportunity.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>
              ) : null}
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
              form="convert-lead-form"
              disabled={submitting}
              variant="gradient"
              className="min-w-32"
            >
              {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account already exists</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictMessage ?? "An account with this name already exists."}{" "}
              Convert anyway as a separate account, or cancel and switch the
              account selector to &ldquo;Attach to an existing account&rdquo; to
              pick the candidate.
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
