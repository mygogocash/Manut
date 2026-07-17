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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import type { Entity } from "@/services/entity.service";
import {
  createHoliday,
  type PublicHoliday,
  updateHoliday,
} from "@/services/holiday.service";

const schema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  name: z.string().trim().min(1, "Name is required").max(120),
  notes: z.string().max(2000).optional().or(z.literal("")),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface HolidayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  /** Default selected entity for new rows. */
  defaultEntityId?: string;
  holiday?: PublicHoliday | null;
  onSaved: () => void;
}

export function HolidayDialog({
  open,
  onOpenChange,
  entities,
  defaultEntityId,
  holiday,
  onSaved,
}: HolidayDialogProps) {
  const isEditing = !!holiday;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      entityId: "",
      date: "",
      name: "",
      notes: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (holiday) {
      form.reset({
        entityId: holiday.entityId,
        date: holiday.date.slice(0, 10),
        name: holiday.name,
        notes: holiday.notes ?? "",
        isActive: holiday.isActive,
      });
    } else {
      form.reset({
        entityId: defaultEntityId ?? "",
        date: "",
        name: "",
        notes: "",
        isActive: true,
      });
    }
  }, [open, holiday, defaultEntityId, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        entityId: values.entityId,
        date: values.date,
        name: values.name.trim(),
        notes: values.notes?.trim() ? values.notes.trim() : null,
        isActive: values.isActive,
      };
      if (isEditing && holiday) {
        await updateHoliday(holiday.id, {
          date: payload.date,
          name: payload.name,
          notes: payload.notes,
          isActive: payload.isActive,
        });
        toast.success("Holiday updated");
      } else {
        await createHoliday(payload);
        toast.success("Holiday added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details?.[0];
        toast.error(
          detail?.field
            ? `${err.message}: ${detail.field} — ${detail.message}`
            : err.message,
        );
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to save holiday",
        );
      }
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit holiday" : "New public holiday"}
          </DialogTitle>
          <DialogDescription>
            Public holidays observed by an entity. They appear on the leave
            calendar and are excluded from leave-day counts.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="holiday-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {entities.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} ({e.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Republic Day" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes…"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem
                  className={`
                    flex flex-row items-center justify-between rounded-lg border
                    p-3
                  `}
                >
                  <FormLabel
                    htmlFor="holiday-active"
                    className="cursor-pointer text-xs font-medium"
                  >
                    Active
                  </FormLabel>
                  <FormControl>
                    <Switch
                      id="holiday-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
            form="holiday-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Add holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
