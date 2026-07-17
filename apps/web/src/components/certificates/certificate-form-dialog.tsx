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
  type Certificate,
  type CertificateType,
  createCertificate,
} from "@/services/certificate.service";
import { listUsers, type UserListItem } from "@/services/user.service";

const TYPES: { value: CertificateType; label: string }[] = [
  { value: "achievement", label: "Achievement" },
  { value: "appreciation", label: "Appreciation" },
  { value: "recognition", label: "Recognition" },
];

const schema = z.object({
  recipientId: z.string().min(1, "Select a recipient"),
  title: z.string().min(2, "Title is required").max(200),
  type: z.enum(["achievement", "appreciation", "recognition"]),
  message: z.string().max(2000).optional(),
  sig1Name: z.string().max(120).optional(),
  sig1Title: z.string().max(120).optional(),
  sig2Name: z.string().max(120).optional(),
  sig2Title: z.string().max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  recipientId: "",
  title: "",
  type: "achievement",
  message: "",
  sig1Name: "",
  sig1Title: "",
  sig2Name: "",
  sig2Title: "",
};

interface CertificateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (certificate: Certificate) => void;
}

export function CertificateFormDialog({
  open,
  onOpenChange,
  onCreated,
}: CertificateFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [recipients, setRecipients] = useState<UserListItem[]>([]);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(DEFAULTS);
    void listUsers({
      isActive: true,
      limit: 200,
      sortBy: "name",
      sortOrder: "asc",
    })
      .then((res) => setRecipients(res.data))
      .catch(() => toast.error("Failed to load employees"));
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    const signatories = [
      {
        name: values.sig1Name?.trim() ?? "",
        title: values.sig1Title?.trim() ?? "",
      },
      {
        name: values.sig2Name?.trim() ?? "",
        title: values.sig2Title?.trim() ?? "",
      },
    ].filter((s) => s.name.length > 0);

    setSubmitting(true);
    try {
      const res = await createCertificate({
        recipientId: values.recipientId,
        title: values.title,
        message: values.message?.trim() || undefined,
        type: values.type,
        signatories,
      });
      toast.success(
        `Certificate issued and emailed to ${res.data.recipientName}`,
      );
      onCreated(res.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to issue certificate",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-h-[90vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Issue a certificate</DialogTitle>
          <DialogDescription>
            Generates a PDF certificate and emails a download link to the
            recipient.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="recipientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {recipients.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} · {u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className={`
                grid grid-cols-1 gap-4
                sm:grid-cols-3
              `}
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Award title</FormLabel>
                    <FormControl>
                      <Input placeholder="Outstanding Achievement" {...field} />
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="for excellent performance during the first quarter."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <p className="text-muted-foreground text-xs font-medium">
                Signatures (optional, up to two)
              </p>
              {[1, 2].map((n) => (
                <div key={n} className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={n === 1 ? "sig1Name" : "sig2Name"}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={`Signatory ${n} name`}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={n === 1 ? "sig1Title" : "sig2Title"}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={`Signatory ${n} title`}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                )}
                Issue &amp; email
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
