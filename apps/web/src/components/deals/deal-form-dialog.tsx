"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { ApiError } from "@/lib/api-client";
import {
  createDeal,
  type Deal,
  DEAL_STAGE_LABELS,
  DEAL_STAGES,
  updateDeal,
} from "@/services/deal.service";

const formSchema = z.object({
  company: z.string().min(1, "Company name is required").max(300),
  contact: z.string().max(300).optional().or(z.literal("")),
  value: z.string().min(1, "Value is required"),
  stage: z.string().min(1, "Stage is required"),
  probability: z.string().optional().or(z.literal("")),
  type: z.string().max(100).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  partnerId: z.string().optional().or(z.literal("")),
  closeDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface DealFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  onSaved: () => void;
}

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
  onSaved,
}: DealFormDialogProps) {
  const isEditing = !!deal;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company: "",
      contact: "",
      value: "",
      stage: "lead",
      probability: "10",
      type: "",
      country: "",
      partnerId: "",
      closeDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (deal) {
      form.reset({
        company: deal.company,
        contact: deal.contact ?? "",
        value: String(deal.value),
        stage: deal.stage,
        probability: String(deal.probability),
        type: deal.type ?? "",
        country: deal.country ?? "",
        partnerId: deal.partnerId ?? "",
        closeDate: deal.closeDate ? String(deal.closeDate).slice(0, 10) : "",
        notes: deal.notes ?? "",
      });
    } else {
      form.reset({
        company: "",
        contact: "",
        value: "",
        stage: "lead",
        probability: "10",
        type: "",
        country: "",
        partnerId: "",
        closeDate: "",
        notes: "",
      });
    }
  }, [open, deal, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        company: values.company,
        contact: values.contact || undefined,
        value: Number(values.value),
        stage: values.stage,
        probability: values.probability
          ? Number(values.probability)
          : undefined,
        type: values.type || undefined,
        country: values.country || undefined,
        partnerId: values.partnerId || undefined,
        closeDate: values.closeDate || undefined,
        notes: values.notes || undefined,
      };

      if (isEditing) {
        await updateDeal(deal.id, payload);
        toast.success("Deal updated");
      } else {
        await createDeal(payload);
        toast.success("Deal created");
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
          <DialogTitle>{isEditing ? "Edit deal" : "New deal"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${deal.company}.`
              : "Add a new deal to the pipeline."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="deal-form"
          >
            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Deal info
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Company / Deal name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Contact person</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value (USD) *</FormLabel>
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
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probability (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          {DEAL_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {DEAL_STAGE_LABELS[s]}
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
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. SaaS, Consulting" {...field} />
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
                      <FormControl>
                        <Input placeholder="e.g. UAE" {...field} />
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
                        placeholder="Internal notes about this deal…"
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
            form="deal-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
