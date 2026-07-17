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
import { type Account, listAccounts } from "@/services/revenue-account.service";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPES,
  type ActivityType,
  createCrmActivity,
  type CrmActivity,
  updateCrmActivity,
} from "@/services/revenue-activity.service";
import { type Contact, listContacts } from "@/services/revenue-contact.service";
import { type Lead, listLeads } from "@/services/revenue-lead.service";
import {
  listOpportunities,
  type Opportunity,
} from "@/services/revenue-opportunity.service";

const PARENT_KINDS = ["lead", "opportunity", "contact", "account"] as const;

type ParentKind = (typeof PARENT_KINDS)[number];

const PARENT_KIND_LABELS: Record<ParentKind, string> = {
  lead: "Lead",
  opportunity: "Opportunity",
  contact: "Contact",
  account: "Account",
};

const formSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().min(1, "Subject is required").max(300),
  body: z.string().max(10000).optional().or(z.literal("")),
  occurredAt: z
    .string()
    .min(1, "Pick when this happened")
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Invalid datetime"),
  durationMins: z.string().optional().or(z.literal("")),
  parentKind: z.enum(PARENT_KINDS),
  parentId: z.string().min(1, "Pick the parent record"),
});

type FormValues = z.infer<typeof formSchema>;

interface ActivityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: CrmActivity | null;
  // Optional preset for callers opening from a parent record's detail.
  presetParent?: { kind: ParentKind; id: string };
  onSaved: () => void;
}

function inferParentKind(activity: CrmActivity): ParentKind {
  if (activity.opportunityId) return "opportunity";
  if (activity.leadId) return "lead";
  if (activity.contactId) return "contact";
  return "account";
}

function inferParentId(activity: CrmActivity): string {
  return (
    activity.opportunityId ??
    activity.leadId ??
    activity.contactId ??
    activity.accountId ??
    ""
  );
}

function toLocalInput(iso: string): string {
  // <input type="datetime-local"> wants `YYYY-MM-DDTHH:MM` in local time.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  activity,
  presetParent,
  onSaved,
}: ActivityFormDialogProps) {
  const isEditing = !!activity;
  const [submitting, setSubmitting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      type: "call",
      subject: "",
      body: "",
      occurredAt: "",
      durationMins: "",
      parentKind: presetParent?.kind ?? "lead",
      parentId: presetParent?.id ?? "",
    },
  });

  // Load parent options on create only. Editing keeps the existing parent
  // ref locked since the API doesn't support re-targeting.
  useEffect(() => {
    if (!open || isEditing) return;
    let cancelled = false;
    setPickerLoading(true);
    Promise.all([
      listLeads({ page: 1, limit: 100 }).catch(() => ({
        data: [] as Lead[],
        meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })),
      listOpportunities({ page: 1, limit: 100 }).catch(() => ({
        data: [] as Opportunity[],
        meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })),
      listContacts({ page: 1, limit: 100 }).catch(() => ({
        data: [] as Contact[],
        meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })),
      listAccounts({ page: 1, limit: 100 }).catch(() => ({
        data: [] as Account[],
        meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })),
    ])
      .then(([leadsRes, oppsRes, contactsRes, accountsRes]) => {
        if (cancelled) return;
        setLeads(leadsRes.data);
        setOpps(oppsRes.data);
        setContacts(contactsRes.data);
        setAccounts(accountsRes.data);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isEditing]);

  useEffect(() => {
    if (!open) return;
    if (activity) {
      form.reset({
        type: activity.type as ActivityType,
        subject: activity.subject,
        body: activity.body ?? "",
        occurredAt: toLocalInput(activity.occurredAt),
        durationMins:
          activity.durationMins !== null ? String(activity.durationMins) : "",
        parentKind: inferParentKind(activity),
        parentId: inferParentId(activity),
      });
    } else {
      form.reset({
        type: "call",
        subject: "",
        body: "",
        occurredAt: toLocalInput(new Date().toISOString()),
        durationMins: "",
        parentKind: presetParent?.kind ?? "lead",
        parentId: presetParent?.id ?? "",
      });
    }
  }, [open, activity, presetParent, form]);

  const parentKind = form.watch("parentKind");

  // Reset parentId when parentKind changes so a stale selection from a
  // different category doesn't sneak through.
  useEffect(() => {
    if (isEditing) return;
    if (presetParent) return;
    form.setValue("parentId", "");
  }, [parentKind, form, isEditing, presetParent]);

  const parentOptions = (() => {
    if (parentKind === "lead") {
      return leads.map((l) => ({
        id: l.id,
        label: `${l.firstName} ${l.lastName} · ${l.company}`,
      }));
    }
    if (parentKind === "opportunity") {
      return opps.map((o) => ({ id: o.id, label: o.name }));
    }
    if (parentKind === "contact") {
      return contacts.map((c) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName} · ${c.account.name}`,
      }));
    }
    return accounts.map((a) => ({ id: a.id, label: a.name }));
  })();

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const occurredAtIso = new Date(values.occurredAt).toISOString();
      const durationMins = values.durationMins
        ? Number(values.durationMins)
        : undefined;

      if (isEditing && activity) {
        await updateCrmActivity(activity.id, {
          type: values.type,
          subject: values.subject,
          body: values.body || undefined,
          occurredAt: occurredAtIso,
          durationMins,
        });
        toast.success("Activity updated");
      } else {
        await createCrmActivity({
          type: values.type,
          subject: values.subject,
          body: values.body || undefined,
          occurredAt: occurredAtIso,
          durationMins,
          ...(values.parentKind === "lead" && { leadId: values.parentId }),
          ...(values.parentKind === "opportunity" && {
            opportunityId: values.parentId,
          }),
          ...(values.parentKind === "contact" && {
            contactId: values.parentId,
          }),
          ...(values.parentKind === "account" && {
            accountId: values.parentId,
          }),
        });
        toast.success("Activity logged");
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
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit activity" : "Log activity"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update ${activity?.subject}.`
              : "Record a call, email, meeting, or note. Activities anchor to exactly one parent record."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="crm-activity-form"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ACTIVITY_TYPE_LABELS[t]}
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
                name="durationMins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (mins)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Intro call with Jane" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="occurredAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>When *</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && !presetParent ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="parentKind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anchor to *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select kind" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PARENT_KINDS.map((k) => (
                            <SelectItem key={k} value={k}>
                              {PARENT_KIND_LABELS[k]}
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
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{PARENT_KIND_LABELS[parentKind]} *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={pickerLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                pickerLoading
                                  ? "Loading…"
                                  : `Select ${parentKind}`
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parentOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2">
                  <FormDescription>
                    Pickers show the 100 most recent of each kind. A paginated
                    combobox is a follow-up once the workspace stretches past
                    that.
                  </FormDescription>
                </div>
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did you discuss?"
                      rows={4}
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
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="crm-activity-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Log activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
