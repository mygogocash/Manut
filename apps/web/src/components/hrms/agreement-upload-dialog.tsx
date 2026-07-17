"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, Upload } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
  AGREEMENT_TYPE_LABELS,
  AGREEMENT_TYPES,
  type AgreementType,
  createAgreement,
  type EmployeeAgreement,
  updateAgreement,
} from "@/services/hrms.service";
import { uploadFile } from "@/services/upload.service";
import { listUsers, type UserListItem } from "@/services/user.service";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .or(z.literal(""));

const schema = z.object({
  employeeId: z.string().uuid("Select an employee"),
  type: z.enum(AGREEMENT_TYPES),
  title: z.string().min(1, "Title is required").max(200),
  effectiveDate: dateString.optional(),
  expiryDate: dateString.optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface AgreementUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreement?: EmployeeAgreement | null;
  /** Pre-fill + lock employee select (folder view passes the current employee). */
  defaultEmployeeId?: string;
  /** Pre-fill the type select (per-type Upload buttons in folder view). */
  defaultType?: AgreementType;
  onSaved: () => void;
}

const DEFAULTS: FormValues = {
  employeeId: "",
  type: "employment_contract",
  title: "",
  effectiveDate: "",
  expiryDate: "",
  notes: "",
};

export function AgreementUploadDialog({
  open,
  onOpenChange,
  agreement,
  defaultEmployeeId,
  defaultType,
  onSaved,
}: AgreementUploadDialogProps) {
  const isEditing = Boolean(agreement);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<UserListItem[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        setEmployeesLoading(true);
        const res = await listUsers({ limit: 500, isActive: true });
        if (!cancelled) setEmployees(res.data);
      } catch {
        if (!cancelled) toast.error("Failed to load employees");
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    if (agreement) {
      form.reset({
        employeeId: agreement.employee.id,
        type: agreement.type,
        title: agreement.title,
        effectiveDate: agreement.effectiveDate?.slice(0, 10) ?? "",
        expiryDate: agreement.expiryDate?.slice(0, 10) ?? "",
        notes: agreement.notes ?? "",
      });
    } else {
      form.reset({
        ...DEFAULTS,
        ...(defaultEmployeeId && { employeeId: defaultEmployeeId }),
        ...(defaultType && { type: defaultType }),
      });
    }
  }, [open, agreement, defaultEmployeeId, defaultType, form]);

  async function onSubmit(values: FormValues) {
    if (!isEditing && !file) {
      toast.error("Pick a file to upload");
      return;
    }
    try {
      setSubmitting(true);

      let uploaded: {
        url: string;
        filename: string;
        mimeType: string;
        size: number;
      } | null = null;
      if (file) {
        const res = await uploadFile(file, {
          bucket: "documents",
          purpose: "employee-agreement",
          linkedTo: "employee",
          linkedId: values.employeeId,
        });
        uploaded = {
          url: res.url,
          filename: res.originalName,
          mimeType: res.mimeType,
          size: res.size,
        };
      }

      if (isEditing && agreement) {
        await updateAgreement(agreement.id, {
          type: values.type,
          title: values.title,
          effectiveDate: values.effectiveDate || undefined,
          expiryDate: values.expiryDate || undefined,
          notes: values.notes?.trim() || undefined,
          ...(uploaded && {
            fileUrl: uploaded.url,
            fileName: uploaded.filename,
            mimeType: uploaded.mimeType,
            fileSize: uploaded.size,
          }),
        });
        toast.success("Agreement updated");
      } else {
        await createAgreement({
          employeeId: values.employeeId,
          type: values.type,
          title: values.title,
          fileUrl: uploaded!.url,
          fileName: uploaded!.filename,
          mimeType: uploaded!.mimeType,
          fileSize: uploaded!.size,
          effectiveDate: values.effectiveDate || undefined,
          expiryDate: values.expiryDate || undefined,
          notes: values.notes?.trim() || undefined,
        });
        toast.success("Agreement uploaded");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      // Always log the full error so HR can paste the console output if
      // the toast text isn't enough to diagnose.
      // eslint-disable-next-line no-console
      console.error("[agreement upload] failed:", err);

      if (err instanceof ApiError) {
        const details = err.details ?? [];
        if (details.length > 0) {
          const firstField = details[0]?.field;
          const firstMessage = details[0]?.message;
          toast.error(
            firstField
              ? `${err.message}: ${firstField} — ${firstMessage}`
              : `${err.message}: ${firstMessage}`,
          );
        } else {
          // Server returned a 422 / 400 but no details — surface the
          // status code + error code so we can tell apart "Zod with
          // empty issues" from "auth / network / something else".
          toast.error(`${err.message} [${err.status} ${err.code}]`);
        }
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to save agreement",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const type = form.watch("type") as AgreementType;

  // Auto-fill title with the type label when blank.
  useEffect(() => {
    const current = form.getValues("title");
    if (!current && !isEditing) {
      form.setValue("title", AGREEMENT_TYPE_LABELS[type]);
    }
  }, [type, form, isEditing]);

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
          sm:max-w-xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit agreement" : "Upload agreement"}
          </DialogTitle>
          <DialogDescription>
            Upload a document (working agreement, visa, passport, etc.) for an
            employee. Replacing the file is optional when editing.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="agreement-upload-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={
                      isEditing ||
                      Boolean(defaultEmployeeId) ||
                      employeesLoading
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            employeesLoading ? "Loading…" : "Select employee"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                          {u.email && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {u.email}
                            </span>
                          )}
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
                grid grid-cols-1 gap-3
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AGREEMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {AGREEMENT_TYPE_LABELS[t]}
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
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Working Agreement 2026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <Label htmlFor="agreement-file">
                File {isEditing ? "(replace, optional)" : "*"}
              </Label>
              <Input
                id="agreement-file"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.heic"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={submitting}
              />
              {isEditing && agreement && !file && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Current: {agreement.fileName}
                </p>
              )}
            </div>

            <div
              className={`
                grid grid-cols-1 gap-3
                sm:grid-cols-2
              `}
            >
              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective date</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date</FormLabel>
                    <FormControl>
                      <FormDatePicker {...field} />
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
                      rows={3}
                      placeholder="Optional notes…"
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
            form="agreement-upload-form"
            disabled={submitting}
            className="min-w-32"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isEditing ? "Save changes" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
