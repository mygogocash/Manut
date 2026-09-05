"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
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
import { uploadFile } from "@/services/upload.service";
import { listUsers, type UserListItem } from "@/services/user.service";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2 MB
const SIGNATURE_MIME_TYPES = ["image/png", "image/jpeg"];

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
  // Signature images per signatory (index 0 = signatory 1). Kept out of
  // react-hook-form since RHF doesn't manage File objects cleanly.
  const [signatureFiles, setSignatureFiles] = useState<(File | null)[]>([
    null,
    null,
  ]);
  // Preview object URLs are derived from `signatureFiles` in an effect (not
  // inline in render) and revoked on change/unmount so we don't leak a fresh
  // blob URL on every re-render.
  const [signaturePreviews, setSignaturePreviews] = useState<(string | null)[]>(
    [null, null],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    const urls = signatureFiles.map((f) => (f ? URL.createObjectURL(f) : null));
    setSignaturePreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [signatureFiles]);

  useEffect(() => {
    if (!open) return;
    form.reset(DEFAULTS);
    setSignatureFiles([null, null]);
    void listUsers({
      isActive: true,
      limit: 200,
      sortBy: "name",
      sortOrder: "asc",
    })
      .then((res) => setRecipients(res.data))
      .catch(() => toast.error("Failed to load employees"));
  }, [open, form]);

  function handleSignatureChange(index: number, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    if (!SIGNATURE_MIME_TYPES.includes(file.type)) {
      toast.error("Signature must be a PNG or JPG image");
      // Clear so re-picking the same (rejected) file still fires onChange.
      input.value = "";
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      toast.error("Signature image must be 2 MB or smaller");
      input.value = "";
      return;
    }
    setSignatureFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

  function clearSignature(index: number) {
    setSignatureFiles((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  async function onSubmit(values: FormValues) {
    const names = [
      values.sig1Name?.trim() ?? "",
      values.sig2Name?.trim() ?? "",
    ];
    const titles = [
      values.sig1Title?.trim() ?? "",
      values.sig2Title?.trim() ?? "",
    ];

    // A signature image has no place to render without a name beneath it.
    for (let i = 0; i < 2; i++) {
      if (signatureFiles[i] && !names[i]) {
        toast.error(
          `Add a name for signatory ${i + 1} to include its signature.`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      // Upload signature images first so we can send stable storage URLs in
      // the create payload. Private `documents` bucket — signatures are
      // sensitive and never need a public URL.
      const signatureUrls: (string | undefined)[] = [undefined, undefined];
      for (let i = 0; i < 2; i++) {
        const file = signatureFiles[i];
        if (file && names[i]) {
          const uploaded = await uploadFile(file, {
            bucket: "documents",
            purpose: "certificate-signature",
          });
          signatureUrls[i] = uploaded.url;
        }
      }

      const signatories = [0, 1]
        .map((i) => ({
          name: names[i],
          title: titles[i],
          signatureUrl: signatureUrls[i],
        }))
        .filter((s) => s.name.length > 0);

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
              {[1, 2].map((n) => {
                const idx = n - 1;
                const preview = signaturePreviews[idx];
                return (
                  <div key={n} className="space-y-2 rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-3">
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

                    {preview ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview}
                          alt={`Signatory ${n} signature`}
                          className={`
                            h-10 w-auto max-w-[160px] rounded border bg-white
                            object-contain p-1
                          `}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => clearSignature(idx)}
                        >
                          <X className="mr-1 size-3.5" aria-hidden />
                          Remove signature
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Input
                          type="file"
                          accept="image/png,image/jpeg"
                          aria-label={`Signatory ${n} signature image`}
                          className="text-xs"
                          onChange={(e) => handleSignatureChange(idx, e.target)}
                        />
                        <p className="text-muted-foreground text-[11px]">
                          Optional signature image — PNG or JPG, max 2 MB.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
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
