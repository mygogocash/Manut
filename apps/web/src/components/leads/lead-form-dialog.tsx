"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { LeadSourceCombobox } from "@/components/leads/lead-source-combobox";
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
import { useLeadSources } from "@/hooks/use-lead-sources";
import { ApiError } from "@/lib/api-client";
import {
  createLead,
  type Lead,
  LEAD_STATUS_LABELS,
  updateLead,
} from "@/services/crm-lead.service";

// REP_SETTABLE_STATUSES mirrors the apps/api zod schema. `converted` and
// `disqualified` are dedicated endpoints (`POST /:id/{convert,disqualify}`),
// not free-form values from this form.
const REP_STATUSES = ["new", "contacted", "qualified"] as const;

const formSchema = z.object({
  company: z.string().min(1, "Company is required").max(300),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Must be a valid email").max(200).or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  title: z.string().max(150).optional().or(z.literal("")),
  // Source is validated server-side against the active lead_sources rows;
  // here we just enforce the code shape so the picker round-trips cleanly.
  source: z
    .string()
    .min(1, "Source is required")
    .regex(/^[a-z][a-z0-9-]*$/, "Source must be a lowercase code"),
  status: z.enum(REP_STATUSES),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSaved: () => void;
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  onSaved,
}: LeadFormDialogProps) {
  const isEditing = !!lead;
  const [submitting, setSubmitting] = useState(false);
  // Sources come from the lead_sources table.
  const { sources } = useLeadSources();

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      company: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      title: "",
      // Source is server-validated against the active `lead_sources`
      // rows. Hardcoding `"web"` here broke create-flow on workspaces
      // that don't have that legacy row seeded — the form would
      // silently submit `web` and the API rejected it with
      // "Source 'web' is not an active lead source." We let it start
      // empty and either auto-select the first active source (effect
      // below) or surface a zod required-field error so the rep
      // can't submit a row the server will reject.
      source: "",
      status: "new",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (lead) {
      // Editing a converted/disqualified lead would route through a dedicated
      // endpoint. The page-level guard prevents the form from opening on
      // those rows; defensive default here just in case.
      const editableStatus =
        lead.status === "converted" || lead.status === "disqualified"
          ? "qualified"
          : (lead.status as (typeof REP_STATUSES)[number]);
      form.reset({
        company: lead.company,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        title: lead.title ?? "",
        source: lead.source,
        status: editableStatus,
        notes: lead.notes ?? "",
      });
    } else {
      form.reset({
        company: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        title: "",
        source: "",
        status: "new",
        notes: "",
      });
    }
  }, [open, lead, form]);

  // When `sources` finally resolves, auto-pick the first active row
  // as the default for new leads so reps don't have to crack the
  // dropdown for every entry. Editing flows keep the persisted source.
  useEffect(() => {
    if (!open || lead) return;
    if (sources.length === 0) return;
    const current = form.getValues("source");
    if (current && sources.some((s) => s.code === current)) return;
    const firstActive = sources[0];
    if (firstActive) {
      form.setValue("source", firstActive.code, { shouldDirty: false });
    }
  }, [open, lead, sources, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        company: values.company,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        title: values.title || undefined,
        source: values.source,
        status: values.status,
        notes: values.notes || undefined,
      };

      if (isEditing) {
        await updateLead(lead.id, payload);
        toast.success("Lead updated");
      } else {
        await createLead(payload);
        toast.success("Lead created");
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
          <DialogTitle>{isEditing ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${lead.firstName} ${lead.lastName} at ${lead.company}.`
              : "Capture a fresh inquiry. Convert to an Opportunity once it's qualified."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="lead-form"
          >
            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Company
              </p>
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Acme Corp" {...field} />
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
                Contact
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
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
                          placeholder="jane@acme.com"
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
                        <Input placeholder="+66 …" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Head of Sales" {...field} />
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
                Lifecycle
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source *</FormLabel>
                      <FormControl>
                        <LeadSourceCombobox
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REP_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {LEAD_STATUS_LABELS[s]}
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
                Notes
              </p>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Background on this inquiry…"
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
            form="lead-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
