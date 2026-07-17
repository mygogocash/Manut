"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { useInvestorTypes } from "@/hooks/use-investor-types";
import { ApiError } from "@/lib/api-client";
import {
  createInvestor,
  type Investor,
  INVESTOR_STATUSES,
  INVESTOR_VISIBILITIES,
  investorStatusLabel,
  updateInvestor,
} from "@/services/investor.service";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  type: z.string().min(1, "Type is required"),
  status: z.string().min(1),
  visibility: z.string().min(1),
  contactName: z.string().max(200).optional().or(z.literal("")),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  // Pipeline import fields.
  title: z.string().max(200).optional().or(z.literal("")),
  linkedinUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  revenueStream: z.string().max(500).optional().or(z.literal("")),
  lastContactDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .or(z.literal(""))
    .optional(),
  nextAction: z.string().max(1000).optional().or(z.literal("")),
  actInvestment: z.string().max(200).optional().or(z.literal("")),
  estInvestment: z.string().max(200).optional().or(z.literal("")),
  crossSell: z.string().max(500).optional().or(z.literal("")),
  region: z.string().max(200).optional().or(z.literal("")),
  notesText: z.string().max(5000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface InvestorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor?: Investor | null;
  onSaved: (saved: Investor) => void;
}

export function InvestorFormDialog({
  open,
  onOpenChange,
  investor,
  onSaved,
}: InvestorFormDialogProps) {
  const isEditing = !!investor;
  const [submitting, setSubmitting] = useState(false);
  const { types: investorTypes } = useInvestorTypes();

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      status: "lead",
      visibility: "team",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
      location: "",
      title: "",
      linkedinUrl: "",
      revenueStream: "",
      lastContactDate: "",
      nextAction: "",
      actInvestment: "",
      estInvestment: "",
      crossSell: "",
      region: "",
      notesText: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (investor) {
      form.reset({
        name: investor.name,
        type: investor.type,
        status: investor.status,
        visibility: investor.visibility ?? "team",
        contactName: investor.contactName ?? "",
        contactEmail: investor.contactEmail ?? "",
        contactPhone: investor.contactPhone ?? "",
        website: investor.website ?? "",
        location: investor.location ?? "",
        title: investor.title ?? "",
        linkedinUrl: investor.linkedinUrl ?? "",
        revenueStream: investor.revenueStream ?? "",
        lastContactDate: investor.lastContactDate?.slice(0, 10) ?? "",
        nextAction: investor.nextAction ?? "",
        actInvestment: investor.actInvestment ?? "",
        estInvestment: investor.estInvestment ?? "",
        crossSell: investor.crossSell ?? "",
        region: investor.region ?? "",
        notesText: investor.notesText ?? "",
      });
    } else {
      form.reset({
        name: "",
        type: "",
        status: "lead",
        visibility: "team",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        website: "",
        location: "",
        title: "",
        linkedinUrl: "",
        revenueStream: "",
        lastContactDate: "",
        nextAction: "",
        actInvestment: "",
        estInvestment: "",
        crossSell: "",
        region: "",
        notesText: "",
      });
    }
  }, [open, investor, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        name: values.name,
        type: values.type,
        status: values.status,
        visibility: values.visibility,
        contactName: values.contactName || undefined,
        contactEmail: values.contactEmail || undefined,
        contactPhone: values.contactPhone || undefined,
        website: values.website || undefined,
        location: values.location || undefined,
        title: values.title || "",
        linkedinUrl: values.linkedinUrl || "",
        revenueStream: values.revenueStream || "",
        lastContactDate: values.lastContactDate || "",
        nextAction: values.nextAction || "",
        actInvestment: values.actInvestment || "",
        estInvestment: values.estInvestment || "",
        crossSell: values.crossSell || "",
        region: values.region || "",
        notesText: values.notesText || "",
      };

      if (isEditing) {
        const res = await updateInvestor(investor.id, payload);
        toast.success("Investor updated");
        onSaved(res.data);
      } else {
        const res = await createInvestor(payload);
        toast.success("Investor created");
        onSaved(res.data);
      }
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

  const VISIBILITY_LABELS: Record<string, string> = {
    team: "Team",
    private: "Private",
    public: "Public",
  };

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
          <DialogTitle>
            {isEditing ? "Edit investor" : "Add investor"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${investor.name}.`
              : "Add a new investor to the pipeline."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="investor-form"
          >
            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Investor info
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sequoia Capital" {...field} />
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
                      <FormLabel>Type *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {investorTypes.map((t) => (
                            <SelectItem key={t.key} value={t.key}>
                              {t.label}
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
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
                          {INVESTOR_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {investorStatusLabel(s)}
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
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility</FormLabel>
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
                          {INVESTOR_VISIBILITIES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {VISIBILITY_LABELS[v]}
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
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. San Francisco, CA"
                          {...field}
                        />
                      </FormControl>
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
                      <FormControl>
                        <Input placeholder="e.g. UAE / GCC" {...field} />
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
                Contact person
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key contact</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Managing Director"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 ..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://linkedin.com/in/..."
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
                Pipeline
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="revenueStream"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revenue stream</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Manut + SunJoy" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastContactDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last contact</FormLabel>
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
                  name="nextAction"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Next action</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Warm intro via CVC DIF"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actInvestment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Act. investment</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. $50K or TBD" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estInvestment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Est. investment</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. $200K or TBD" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="crossSell"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cross-sell</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Manut + SunJoy" {...field} />
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
                name="notesText"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Internal notes / pitch context…"
                        rows={4}
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
            form="investor-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Add investor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
