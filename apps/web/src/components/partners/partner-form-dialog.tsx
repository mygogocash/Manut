"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  PartnerCompanyFields,
  PartnerContractFields,
  PartnerNotesField,
  PartnerTrackingFields,
} from "@/components/partners/partner-company-fields";
import { PartnerContactFields } from "@/components/partners/partner-contact-fields";
import {
  PARTNER_FORM_DEFAULTS,
  partnerFormSchema,
  type PartnerFormValues,
} from "@/components/partners/partner-form-schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { ApiError } from "@/lib/api-client";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  createPartner,
  getPartner,
  type Partner,
  type PartnerDepartment,
  updatePartner,
} from "@/services/partner.service";

interface PartnerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: Partner | null;
  onSaved: (saved: Partner) => void;
}

export function PartnerFormDialog({
  open,
  onOpenChange,
  partner,
  onSaved,
}: PartnerFormDialogProps) {
  const isEditing = !!partner;
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<PartnerFormValues>({
    resolver: standardSchemaResolver(partnerFormSchema),
    defaultValues: PARTNER_FORM_DEFAULTS,
  });

  const fieldArray = useFieldArray({
    control: form.control,
    name: "contacts",
  });

  const [loadingPartner, setLoadingPartner] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  // Eager-fetch a workforce slice once per dialog open. 200 covers most
  // workspaces; if the partner's existing owner sits past that, the
  // form-load effect injects them below so the picker still shows
  // a label.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await listAssignableUsers({ page: 1, limit: 200 });
        if (!cancelled) setAssignableUsers(res.data);
      } catch {
        if (!cancelled) setAssignableUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (partner) {
      let cancelled = false;
      setLoadingPartner(true);
      getPartner(partner.id)
        .then((res) => {
          if (cancelled) return;
          const full = res.data;
          form.reset({
            company: full.company,
            type: full.type,
            status: full.status,
            region: full.region ?? "",
            country: full.country ?? "",
            website: full.website ?? "",
            description: full.description ?? "",
            contractValue: full.contractValue?.toString() ?? "",
            contractStart: full.contractStart
              ? String(full.contractStart).slice(0, 10)
              : "",
            contractEnd: full.contractEnd
              ? String(full.contractEnd).slice(0, 10)
              : "",
            notes: full.notes ?? "",
            productionLiveDate: full.productionLiveDate
              ? String(full.productionLiveDate).slice(0, 10)
              : "",
            goLiveDate: full.goLiveDate
              ? String(full.goLiveDate).slice(0, 10)
              : "",
            revisedGoLiveDate: full.revisedGoLiveDate
              ? String(full.revisedGoLiveDate).slice(0, 10)
              : "",
            dependency: full.dependency ?? "",
            comment: full.comment ?? "",
            department: full.department ?? "",
            ownerId: full.owner?.id ?? full.ownerId ?? "",
            contacts:
              full.contacts?.map((c) => ({
                name: c.name,
                title: c.title ?? "",
                email: c.email ?? "",
                phone: c.phone ?? "",
                isPrimary: c.isPrimary,
              })) ?? [],
          });
          // Inject the bound owner if the directory slice didn't.
          if (full.owner) {
            const owner = full.owner;
            setAssignableUsers((prev) =>
              prev.some((u) => u.id === owner.id)
                ? prev
                : [
                    {
                      id: owner.id,
                      name: owner.name,
                      email: owner.email,
                    } as AssignableUser,
                    ...prev,
                  ],
            );
          }
        })
        .catch(() => {
          if (!cancelled) toast.error("Failed to load partner details");
        })
        .finally(() => {
          if (!cancelled) setLoadingPartner(false);
        });
      return () => {
        cancelled = true;
      };
    } else {
      form.reset(PARTNER_FORM_DEFAULTS);
    }
  }, [open, partner, form]);

  async function onSubmit(values: PartnerFormValues) {
    try {
      setSubmitting(true);
      const payload = {
        company: values.company,
        type: values.type,
        status: values.status,
        region: values.region || undefined,
        country: values.country || undefined,
        website: values.website || undefined,
        description: values.description || undefined,
        contractValue: values.contractValue
          ? Number(values.contractValue)
          : undefined,
        contractStart: values.contractStart || undefined,
        contractEnd: values.contractEnd || undefined,
        notes: values.notes || undefined,
        // Empty strings → null so the server distinguishes "user
        // cleared this field" from "not touched". Same convention as
        // ProjectFormDialog (#534).
        productionLiveDate: values.productionLiveDate?.trim()
          ? values.productionLiveDate
          : null,
        goLiveDate: values.goLiveDate?.trim() ? values.goLiveDate : null,
        revisedGoLiveDate: values.revisedGoLiveDate?.trim()
          ? values.revisedGoLiveDate
          : null,
        dependency: values.dependency?.trim() ? values.dependency.trim() : null,
        comment: values.comment?.trim() ? values.comment.trim() : null,
        department: values.department
          ? (values.department as PartnerDepartment)
          : null,
        ownerId: values.ownerId || null,
        contacts: values.contacts.length
          ? values.contacts.map((c) => ({
              name: c.name,
              title: c.title || undefined,
              email: c.email || undefined,
              phone: c.phone || undefined,
              isPrimary: c.isPrimary,
            }))
          : undefined,
      };

      if (isEditing) {
        const res = await updatePartner(partner.id, payload);
        toast.success("Partner updated");
        onSaved(res.data);
      } else {
        const res = await createPartner(payload);
        toast.success("Partner created");
        onSaved(res.data);
      }
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
            {isEditing ? "Edit partner" : "Add partner"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update details for ${partner.company}.`
              : "Add a new partner to the CRM."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            id="partner-form"
          >
            <PartnerCompanyFields form={form} />
            <PartnerContractFields form={form} />
            <PartnerTrackingFields form={form} users={assignableUsers} />
            <PartnerNotesField form={form} />
            <PartnerContactFields form={form} fieldArray={fieldArray} />
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
            form="partner-form"
            disabled={submitting || loadingPartner}
            className="min-w-32"
          >
            {(submitting || loadingPartner) && (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            )}
            {isEditing ? "Save changes" : "Add partner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
