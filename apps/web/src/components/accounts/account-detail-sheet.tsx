"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AccountDetailsSection } from "@/components/accounts/account-details-section";
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
import { type Account, getAccount } from "@/services/crm-account.service";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivityType,
  type CrmActivity,
  listCrmActivities,
} from "@/services/crm-activity.service";
import { type Contact, listContacts } from "@/services/crm-contact.service";
import {
  listOpportunities,
  type Opportunity,
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from "@/services/crm-opportunity.service";

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

interface AccountDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  onEdit?: (account: Account) => void;
}

export function AccountDetailSheet({
  open,
  onOpenChange,
  accountId,
  onEdit,
}: AccountDetailSheetProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      const [accountRes, contactsRes, oppsRes, actsRes] = await Promise.all([
        getAccount(accountId),
        listContacts({ accountId, limit: 50 }).catch(() => ({
          data: [] as Contact[],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })),
        listOpportunities({ accountId, limit: 50 }).catch(() => ({
          data: [] as Opportunity[],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })),
        listCrmActivities({ accountId, limit: 50 }).catch(() => ({
          data: [] as CrmActivity[],
          meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
        })),
      ]);
      setAccount(accountRes.data);
      setContacts(contactsRes.data);
      setOpportunities(oppsRes.data);
      setActivities(actsRes.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load account";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!open || !accountId) return;
    fetchData();
  }, [open, accountId, fetchData]);

  useEffect(() => {
    if (!open) {
      setAccount(null);
      setContacts([]);
      setOpportunities([]);
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
            {account ? account.name : loading ? "Loading…" : "Account"}
          </SheetTitle>
          <SheetDescription>
            {account?.domain ?? "Account detail"}
          </SheetDescription>
        </SheetHeader>

        {loading && !account ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : account ? (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            <AccountDetailsSection account={account} showName={false} />

            <section className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Contacts ({contacts.length})
              </p>
              {contacts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No contacts on this account.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {contacts.map((c) => (
                    <li
                      key={c.id}
                      className={`
                        border-border bg-background flex items-center
                        justify-between gap-2 rounded-md border px-2 py-1.5
                      `}
                    >
                      <span className="text-foreground text-sm">
                        {c.firstName} {c.lastName}
                        {c.title ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.title}
                          </span>
                        ) : null}
                      </span>
                      {c.isPrimary ? (
                        <Badge status="primary">Primary</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Opportunities ({opportunities.length})
              </p>
              {opportunities.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No opportunities tied to this account.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {opportunities.map((o) => (
                    <li
                      key={o.id}
                      className={`
                        border-border bg-background flex items-center
                        justify-between gap-2 rounded-md border px-2 py-1.5
                      `}
                    >
                      <div className="flex flex-col">
                        <span className="text-foreground text-sm font-medium">
                          {o.name}
                        </span>
                        <span
                          className={`
                            text-muted-foreground text-[11px] tabular-nums
                          `}
                        >
                          {formatCurrency(Number(o.value), o.currency)} ·{" "}
                          {o.probability}%
                        </span>
                      </div>
                      <Badge status={o.stage}>
                        {OPPORTUNITY_STAGE_LABELS[
                          o.stage as OpportunityStage
                        ] ?? o.stage}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

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
                  No activities logged on this account.
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

        {account && onEdit ? (
          <div
            className={`
              border-border flex flex-wrap items-center justify-end gap-2
              border-t p-4
            `}
          >
            <PermissionButton
              permission="crm:update"
              variant="outline"
              onClick={() => onEdit(account)}
            >
              Edit
            </PermissionButton>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
