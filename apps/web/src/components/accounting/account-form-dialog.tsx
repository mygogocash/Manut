"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  type AccountReuseCheck,
  type ChartOfAccount,
  checkAccountReuse,
  createAccount,
  updateAccount,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;

const ENGLISH_LETTERS_AND_SPACES = /^[A-Za-z ]+$/;

function requiredIfNew(originalEmpty: boolean, max: number, message: string) {
  const base = z.string().trim().max(max);
  return originalEmpty ? base : base.min(1, message);
}

function accountFormSchema(original?: ChartOfAccount | null) {
  const legacyThaiName = Boolean(original && !original.nameTh?.trim());
  const legacyEnDesc = Boolean(original && !original.description?.trim());
  const legacyThDesc = Boolean(original && !original.descriptionTh?.trim());
  return z
    .object({
      entityId: z.string().min(1, "Entity is required"),
      code: z.string().trim().min(1, "Code is required").max(20),
      name: z.string().trim().min(1, "English name is required").max(200),
      nameTh: requiredIfNew(legacyThaiName, 200, "Thai name is required"),
      description: requiredIfNew(
        legacyEnDesc,
        2000,
        "English description is required",
      ),
      descriptionTh: requiredIfNew(
        legacyThDesc,
        2000,
        "Thai description is required",
      ),
      type: z.enum(ACCOUNT_TYPES, { required_error: "Type is required" }),
      parentId: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      const nameChanged = !original || values.name !== original.name;
      const descriptionChanged =
        !original || values.description !== (original.description ?? "");
      if (nameChanged && !ENGLISH_LETTERS_AND_SPACES.test(values.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["name"],
          message: "English fields may contain only English letters and spaces",
        });
      }
      if (
        descriptionChanged &&
        !ENGLISH_LETTERS_AND_SPACES.test(values.description)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["description"],
          message: "English fields may contain only English letters and spaces",
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof accountFormSchema>>;

const NONE_VALUE = "__none__";

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  accounts: ChartOfAccount[];
  account?: ChartOfAccount | null;
  onSaved: () => void;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  entities,
  accounts,
  account,
  onSaved,
}: AccountFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [reuse, setReuse] = useState<AccountReuseCheck | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const isEdit = Boolean(account);

  const form = useForm<FormValues>({
    resolver: zodResolver(accountFormSchema(account)),
    mode: "onChange",
    defaultValues: {
      entityId: "",
      code: "",
      name: "",
      nameTh: "",
      description: "",
      descriptionTh: "",
      type: "asset",
      parentId: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      account
        ? {
            entityId: account.entityId,
            code: account.code,
            name: account.name,
            nameTh: account.nameTh ?? "",
            description: account.description ?? "",
            descriptionTh: account.descriptionTh ?? "",
            type: (ACCOUNT_TYPES as readonly string[]).includes(account.type)
              ? (account.type as FormValues["type"])
              : "asset",
            parentId: account.parentId ?? "",
          }
        : {
            entityId: "",
            code: "",
            name: "",
            nameTh: "",
            description: "",
            descriptionTh: "",
            type: "asset",
            parentId: "",
          },
    );
    setReuse(null);
    setAcknowledged(false);
  }, [open, account, form]);

  // Preflight: does this code or English name belong to a DEACTIVATED account?
  // Runs as the user types so the warning and its tick-box are on screen before
  // they press save, rather than arriving as a rejection afterwards. The server
  // re-runs the same rules on save — this is only the courtesy half.
  const watchedEntityId = form.watch("entityId");
  const watchedCode = form.watch("code");
  const watchedName = form.watch("name");

  useEffect(() => {
    if (!open) return;
    const entityId = watchedEntityId || account?.entityId;
    const code = watchedCode?.trim() ?? "";
    const name = watchedName?.trim() ?? "";
    // Nothing to ask about until there is an entity and something to look up,
    // and never for values the account already has.
    const codeChanged = !account || code !== account.code;
    const nameChanged = !account || name !== account.name;
    if (!entityId || (!codeChanged && !nameChanged) || (!code && !name)) {
      setReuse(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkAccountReuse({
        entityId,
        ...(codeChanged && code ? { code } : {}),
        ...(nameChanged && name ? { name } : {}),
        ...(account ? { excludeAccountId: account.id } : {}),
      })
        .then((res) => {
          if (cancelled) return;
          setReuse(res.data.outcome === "allow" ? null : res.data);
          if (res.data.outcome === "allow") setAcknowledged(false);
        })
        // A failed preflight must never block the form. The save path enforces
        // the same rules, so the worst case is the user sees the warning later.
        .catch(() => {
          if (!cancelled) setReuse(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, account, watchedEntityId, watchedCode, watchedName]);

  const reuseBlocks = reuse?.outcome === "block";
  const needsAcknowledgement = reuse?.outcome === "acknowledge";

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      if (account) {
        const payload: Parameters<typeof updateAccount>[1] = {
          nameTh: values.nameTh,
          descriptionTh: values.descriptionTh,
          type: values.type,
          parentId: values.parentId || undefined,
        };
        if (needsAcknowledgement) payload.acknowledgeInactiveReuse = true;
        if (values.code !== account.code) payload.code = values.code;
        if (values.name !== account.name) payload.name = values.name;
        if (values.description !== (account.description ?? "")) {
          payload.description = values.description;
        }
        await updateAccount(account.id, payload);
        toast.success("Account updated");
      } else {
        const created = await createAccount({
          entityId: values.entityId,
          code: values.code,
          name: values.name,
          nameTh: values.nameTh,
          description: values.description,
          descriptionTh: values.descriptionTh,
          type: values.type,
          parentId: values.parentId || undefined,
          ...(needsAcknowledgement ? { acknowledgeInactiveReuse: true } : {}),
        });
        const warnings = created.data.warnings ?? [];
        if (warnings.length > 0) {
          toast.warning(warnings.map((w) => w.message).join(" "));
        } else {
          toast.success("Account created");
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        for (const detail of err.details) {
          if (detail.field) {
            form.setError(detail.field as keyof FormValues, {
              type: "server",
              message: detail.message,
            });
          }
        }
      }
      const message =
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "Failed to update account"
            : "Failed to create account";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const parentOptions = accounts.filter((a) => a.id !== account?.id);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "Add Account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change only the fields you need. Untouched English names keep their current spelling."
              : "New accounts need Thai and English names and descriptions. English fields may contain only letters and spaces."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="account-form"
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
                    disabled={isEdit}
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
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 1000" {...field} />
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
                    <FormLabel>Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full capitalize">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name (English) *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Cash and Cash Equivalents"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nameTh"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อบัญชี (ภาษาไทย) *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="เช่น เงินสดและรายการเทียบเท่าเงินสด"
                      lang="th"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>English description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Short English description using letters and spaces only"
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
              name="descriptionTh"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>คำอธิบายภาษาไทย *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="คำอธิบายสั้น ๆ เป็นภาษาไทย"
                      lang="th"
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
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Account</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) =>
                      field.onChange(v === NONE_VALUE ? "" : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {parentOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        {reuse ? (
          <div
            className={
              reuseBlocks
                ? `
                  border-destructive/50 bg-destructive/5 grid gap-2 rounded-md
                  border p-3 text-xs
                `
                : `
                  grid gap-2 rounded-md border border-amber-500/50
                  bg-amber-500/5 p-3 text-xs
                `
            }
            role={reuseBlocks ? "alert" : "status"}
          >
            <p className="font-medium">
              {reuseBlocks
                ? "This code or name cannot be reused"
                : "This code or name belonged to a deactivated account"}
            </p>
            {reuse.warnings.map((w) => (
              <p key={`${w.code}-${w.detail?.accountId ?? ""}`}>{w.message}</p>
            ))}
            {reuse.blockers.map((b, i) => (
              <p key={`blocker-${i}`}>{b.message}</p>
            ))}
            {needsAcknowledgement ? (
              <label className="mt-1 flex items-start gap-2 font-medium">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                  aria-label="Confirm the deactivated-account warning"
                />
                <span>
                  I have read this and still want to use this code or name.
                </span>
              </label>
            ) : null}
          </div>
        ) : null}

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
            form="account-form"
            disabled={
              submitting ||
              !form.formState.isValid ||
              reuseBlocks ||
              (needsAcknowledgement && !acknowledged)
            }
            className="min-w-32"
          >
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            {isEdit ? "Save" : "Add Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
