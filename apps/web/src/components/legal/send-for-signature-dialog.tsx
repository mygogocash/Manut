"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type LegalSignature,
  sendDocumentForSignature,
} from "@/services/legal.service";

const signerSchema = z.object({
  signerName: z.string().trim().min(1, "Name is required").max(200),
  signerEmail: z.string().email("Invalid email"),
  signingOrder: z.coerce
    .number<number | string>()
    .int("Whole number")
    .min(1, "Min 1")
    .max(50, "Max 50"),
});

const schema = z.object({
  signers: z.array(signerSchema).min(1, "Add at least one signer").max(20),
  inviteMessage: z.string().max(5000).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface SendForSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentTitle?: string;
  onSent?: (signature: LegalSignature | LegalSignature[]) => void;
}

const EMPTY_DEFAULTS: FormValues = {
  signers: [{ signerName: "", signerEmail: "", signingOrder: 1 }],
  inviteMessage: "",
  expiresAt: "",
};

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SendForSignatureDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  onSent,
}: SendForSignatureDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: EMPTY_DEFAULTS,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "signers",
  });

  useEffect(() => {
    if (!open) {
      form.reset(EMPTY_DEFAULTS);
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    if (!documentId) return;
    try {
      setSubmitting(true);
      const expiresAt = values.expiresAt
        ? new Date(`${values.expiresAt}T23:59:59.999`).toISOString()
        : undefined;
      const signers = values.signers.map((s) => ({
        signerEmail: s.signerEmail,
        signerName: s.signerName,
        signingOrder: s.signingOrder,
      }));
      const res = await sendDocumentForSignature(documentId, {
        signers,
        inviteMessage: values.inviteMessage || undefined,
        expiresAt,
      });
      const recipientLabel =
        signers.length === 1
          ? signers[0]!.signerEmail
          : `${signers.length} signers`;
      toast.success(`Signing request sent to ${recipientLabel}`);
      onSent?.(res.data);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to send signature request";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const nextOrder =
    Math.max(
      0,
      ...form.watch("signers").map((s) => Number(s.signingOrder ?? 1)),
    ) + 1;

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
          <DialogTitle>Send for signature</DialogTitle>
          <DialogDescription>
            {documentTitle
              ? `Email a signing link for "${documentTitle}". Add multiple signers if needed; same order = parallel, different orders = sequential.`
              : "Email a signing link for this document."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="send-for-signature-form"
          >
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Signers *
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    append({
                      signerName: "",
                      signerEmail: "",
                      signingOrder: nextOrder,
                    })
                  }
                >
                  <Plus className="mr-1 size-3" />
                  Add signer
                </Button>
              </div>

              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`
                    border-border bg-surface flex flex-col gap-2 rounded-md
                    border p-3
                  `}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[11px]">
                      Signer {index + 1}
                    </span>
                    {fields.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(index)}
                        aria-label="Remove signer"
                      >
                        <X className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                  <FormField
                    control={form.control}
                    name={`signers.${index}.signerName`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="text-[11px]">Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Full legal name" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name={`signers.${index}.signerEmail`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-[11px]">Email *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="signer@example.com"
                              {...f}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`signers.${index}.signingOrder`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-[11px]">Order</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={f.value as number}
                              onChange={(e) => f.onChange(e.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
              {form.formState.errors.signers?.root && (
                <p className="text-destructive text-xs">
                  {form.formState.errors.signers.root.message}
                </p>
              )}
            </section>

            <FormField
              control={form.control}
              name="inviteMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Optional note included in the email…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expires (optional)</FormLabel>
                  <FormControl>
                    <FormDatePicker {...field} minDate={todayLocalDate()} />
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
            form="send-for-signature-form"
            disabled={submitting || !documentId}
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
