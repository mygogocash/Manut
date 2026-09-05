"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { RemoteAccountPicker } from "@/components/crm/remote-account-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type Contact,
  createContact,
  updateContact,
} from "@/services/crm-contact.service";

const formSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Must be a valid email").max(200).or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  title: z.string().max(150).optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  // Optional preset (e.g. opening from an Account detail). Locks accountId
  // on create so the rep can't accidentally drop the contact under a
  // different parent.
  presetAccountId?: string;
  onSaved: () => void;
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  presetAccountId,
  onSaved,
}: ContactFormDialogProps) {
  const isEditing = !!contact;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      title: "",
      isPrimary: false,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (contact) {
      form.reset({
        accountId: contact.accountId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        title: contact.title ?? "",
        isPrimary: contact.isPrimary,
        notes: contact.notes ?? "",
      });
    } else {
      form.reset({
        accountId: presetAccountId ?? "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        title: "",
        isPrimary: false,
        notes: "",
      });
    }
  }, [open, contact, presetAccountId, form]);

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        title: values.title || undefined,
        isPrimary: values.isPrimary ?? false,
        notes: values.notes || undefined,
      };
      if (isEditing && contact) {
        await updateContact(contact.id, payload);
        toast.success("Contact updated");
      } else {
        await createContact({ accountId: values.accountId, ...payload });
        toast.success("Contact created");
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
            {isEditing ? "Edit contact" : "New contact"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${contact?.firstName} ${contact?.lastName}.`
              : "Add a contact under a sales account. The first contact on an account is auto-promoted to primary."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="contact-form"
          >
            {!isEditing ? (
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account *</FormLabel>
                    <FormControl>
                      <RemoteAccountPicker
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!!presetAccountId}
                        placeholder="Search accounts…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="text-muted-foreground text-sm">
                Account: {contact?.account.name}
              </div>
            )}

            <section className="flex flex-col gap-3">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Person
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

            <FormField
              control={form.control}
              name="isPrimary"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="flex flex-col gap-1">
                    <FormLabel className="cursor-pointer">
                      Primary contact for this account
                    </FormLabel>
                    <FormDescription>
                      Promoting this contact demotes whichever sibling currently
                      holds the primary flag — only one primary per account.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal notes about this contact…"
                      rows={3}
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
            form="contact-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEditing ? "Save changes" : "Create contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
