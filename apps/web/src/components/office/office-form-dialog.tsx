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
import { ApiError } from "@/lib/api-client";
import {
  createOffice,
  type Office,
  updateOffice,
} from "@/services/office.service";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  city: z.string().min(1, "City is required").max(120),
  country: z.string().min(1, "Country is required").max(120),
  address: z.string().max(500).optional().or(z.literal("")),
  timezone: z.string().max(80).optional().or(z.literal("")),
  capacity: z.coerce.number().int().nonnegative(),
});

type FormValues = z.infer<typeof formSchema>;

interface OfficeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  office?: Office | null;
  onSaved: () => void;
}

export function OfficeFormDialog({
  open,
  onOpenChange,
  office,
  onSaved,
}: OfficeFormDialogProps) {
  const isEditing = !!office;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      city: "",
      country: "",
      address: "",
      timezone: "",
      capacity: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (office) {
      form.reset({
        name: office.name,
        city: office.city ?? "",
        country: office.country ?? "",
        address: office.address ?? "",
        timezone: office.timezone ?? "",
        capacity: office.capacity ?? 0,
      });
    } else {
      form.reset({
        name: "",
        city: "",
        country: "",
        address: "",
        timezone: "",
        capacity: 0,
      });
    }
  }, [open, office, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        name: values.name,
        city: values.city,
        country: values.country,
        address: values.address || null,
        timezone: values.timezone || null,
        capacity: values.capacity,
      };

      if (isEditing) {
        await updateOffice(office.id, payload);
        toast.success("Office updated");
      } else {
        await createOffice(payload);
        toast.success("Office created");
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
          sm:max-w-lg
        `}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit office" : "New office"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for "${office.name}".`
              : "Register an office location."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="office-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Bangkok HQ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="Bangkok" {...field} />
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
                    <FormLabel>Country *</FormLabel>
                    <FormControl>
                      <Input placeholder="Thailand" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input placeholder="Asia/Bangkok" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
            form="office-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create office"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
