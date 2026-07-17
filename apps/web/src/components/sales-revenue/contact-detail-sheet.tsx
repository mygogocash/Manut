"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PermissionButton } from "@/components/shared/permission-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityType,
  type CrmActivity,
  listCrmActivities,
} from "@/services/revenue-activity.service";
import { type Contact, getContact } from "@/services/revenue-contact.service";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div
      className={`
        border-border/60 flex items-start justify-between gap-3 border-b py-2
        last:border-b-0
      `}
    >
      <span
        className={`
          text-muted-foreground text-[11px] font-medium tracking-wide uppercase
        `}
      >
        {label}
      </span>
      <span className="text-foreground text-right text-sm">{value}</span>
    </div>
  );
}

interface ContactDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onEdit?: (contact: Contact) => void;
}

export function ContactDetailSheet({
  open,
  onOpenChange,
  contactId,
  onEdit,
}: ContactDetailSheetProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      const [contactRes, actsRes] = await Promise.all([
        getContact(contactId),
        listCrmActivities({ contactId, limit: 50 }).catch(() => ({
          data: [] as CrmActivity[],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })),
      ]);
      setContact(contactRes.data);
      setActivities(actsRes.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load contact";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    if (!open || !contactId) return;
    fetchData();
  }, [open, contactId, fetchData]);

  useEffect(() => {
    if (!open) {
      setContact(null);
      setActivities([]);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`
          flex w-full flex-col gap-0
          sm:max-w-xl
        `}
      >
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {contact
              ? `${contact.firstName} ${contact.lastName}`
              : loading
                ? "Loading…"
                : "Contact"}
          </SheetTitle>
          <SheetDescription>
            {contact?.account?.name ?? "Contact detail"}
          </SheetDescription>
        </SheetHeader>

        {loading && !contact ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : contact ? (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            <section className="flex flex-col">
              <p
                className={`
                  text-muted-foreground mb-2 text-[10px] font-bold
                  tracking-widest uppercase
                `}
              >
                Identity
              </p>
              <DetailRow
                label="Primary"
                value={
                  contact.isPrimary ? (
                    <Badge status="primary">Primary</Badge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )
                }
              />
              <DetailRow label="Account" value={contact.account?.name} />
              <DetailRow label="Title" value={contact.title} />
              <DetailRow
                label="Email"
                value={
                  contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className={`
                        text-primary
                        hover:underline
                      `}
                    >
                      {contact.email}
                    </a>
                  ) : null
                }
              />
              <DetailRow label="Phone" value={contact.phone} />
              <DetailRow
                label="Created"
                value={format(new Date(contact.createdAt), "MMM d, yyyy")}
              />
            </section>

            {contact.notes ? (
              <section className="flex flex-col gap-2">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Notes
                </p>
                <p className="text-foreground text-sm whitespace-pre-wrap">
                  {contact.notes}
                </p>
              </section>
            ) : null}

            <section className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Activities ({activities.length})
              </p>
              {activities.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No activities logged with this contact.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {activities.map((a) => (
                    <li
                      key={a.id}
                      className={`
                        border-border bg-background flex flex-col gap-0.5
                        rounded-md border p-2
                      `}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground text-sm font-medium">
                          {a.subject}
                        </span>
                        <Badge status={a.type}>
                          {ACTIVITY_TYPE_LABELS[a.type as ActivityType] ??
                            a.type}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        {format(new Date(a.occurredAt), "MMM d · h:mm a")}
                        {a.durationMins !== null ? ` · ${a.durationMins}m` : ""}
                        {a.owner ? ` · ${a.owner.name}` : ""}
                      </p>
                      {a.body ? (
                        <p
                          className={`
                            text-foreground mt-1 text-xs whitespace-pre-wrap
                          `}
                        >
                          {a.body}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {contact && onEdit ? (
          <div
            className={`
              border-border flex flex-wrap items-center justify-end gap-2
              border-t p-4
            `}
          >
            <PermissionButton
              permission="sales-revenue:update"
              variant="outline"
              onClick={() => onEdit(contact)}
            >
              Edit
            </PermissionButton>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
