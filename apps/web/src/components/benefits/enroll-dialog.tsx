"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormDatePicker } from "@/components/shared/form-date-picker";
import { Modal, ModalActions } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { type Benefit, enrollInBenefit } from "@/services/benefit.service";

const enrollSchema = z.object({
  benefitId: z.string().min(1, "Please select a benefit"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
});

type EnrollFormValues = z.infer<typeof enrollSchema>;

interface EnrollDialogProps {
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
  benefits: Benefit[];
}

export function EnrollDialog({
  open,
  onClose,
  onEnrolled,
  benefits,
}: EnrollDialogProps) {
  const [saving, setSaving] = useState(false);
  const activeBenefits = benefits.filter((b) => b.isActive);

  const form = useForm<EnrollFormValues>({
    resolver: zodResolver(enrollSchema),
    defaultValues: {
      benefitId: "",
      startDate: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      benefitId: "",
      startDate: new Date().toISOString().slice(0, 10),
    });
  }, [open, form]);

  async function onSubmit(values: EnrollFormValues) {
    try {
      setSaving(true);
      await enrollInBenefit({
        benefitId: values.benefitId,
        startDate: values.startDate,
      });
      toast.success("Successfully enrolled");
      onEnrolled();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to enroll");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enroll in Benefit"
      subtitle="Select a benefit to enroll in"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-4 flex flex-col gap-3"
        >
          <FormField
            control={form.control}
            name="benefitId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Benefit</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a benefit..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {activeBenefits.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.category})
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
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <FormDatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select start date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <ModalActions>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 size-3 animate-spin" />}
              Enroll
            </Button>
          </ModalActions>
        </form>
      </Form>
    </Modal>
  );
}
