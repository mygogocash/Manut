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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  createUpdate,
  type InvestorUpdate,
  updateUpdate,
} from "@/services/investor-update.service";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  period: z.string().min(1, "Period is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface UpdateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorUpdate?: InvestorUpdate | null;
  onSaved: () => void;
}

export function UpdateFormDialog({
  open,
  onOpenChange,
  investorUpdate,
  onSaved,
}: UpdateFormDialogProps) {
  const isEditing = !!investorUpdate;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", content: "", period: "" },
  });

  useEffect(() => {
    if (!open) return;
    if (investorUpdate) {
      form.reset({
        title: investorUpdate.title,
        content: investorUpdate.content,
        period: investorUpdate.period,
      });
    } else {
      form.reset({ title: "", content: "", period: "" });
    }
  }, [open, investorUpdate, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      if (isEditing) {
        await updateUpdate(investorUpdate.id, {
          title: values.title,
          content: values.content,
          period: values.period,
        });
        toast.success("Update saved");
      } else {
        await createUpdate({
          title: values.title,
          content: values.content,
          period: values.period,
          status: "draft",
        });
        toast.success("Draft created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong";
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
            {isEditing ? "Edit update" : "New investor update"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Edit "${investorUpdate.title}".`
              : "Draft a new update for investors."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="update-form"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Q1 2026 Investor Update"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Q1 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your update here…"
                      rows={12}
                      className="min-h-[200px]"
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
            form="update-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
