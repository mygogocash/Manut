"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ItBillingMonthlyTab } from "@/components/it/it-billing-monthly-tab";
import { ItWorkspaceTabs } from "@/components/it/it-workspace-tabs";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  addSubscriptionAttachment,
  BILLING_FREQUENCIES,
  createSubscription,
  createVendor,
  deleteSubscription,
  deleteVendor,
  type ItAttachment,
  type ItSubscription,
  type ItVendor,
  licenseUtilizationReport,
  type LicenseUtilizationRow,
  listSubscriptions,
  listVendors,
  PAYMENT_STATUSES,
  recordRenewalDecision,
  removeSubscriptionAttachment,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUSES,
  type SubscriptionInput,
  type SubscriptionStatus,
  updateSubscription,
  updateVendor,
  type VendorInput,
} from "@/services/it-operations.service";
import { uploadFile } from "@/services/upload.service";

export default function ItBillingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("it:billing:manage");
  // Monthly is the default: "what are we spending and is it going up or down"
  // is the question this page exists to answer, and the flat register cannot
  // answer it. `?tab=subscriptions` links still land where they always did.
  const [tab, setTab] = useTabParam("monthly");

  return (
    <div>
      {/*
        Title names the workspace, subtitle names the surface — the strip
        below is what says where you are. Matches /sales, where every tab
        sits under one "Sales CRM" heading.
      */}
      <PageHeader
        title="IT CRM"
        subtitle="Vendors, subscriptions, renewals, and spend"
      />

      {/* Replaces the back-to-Operations button this header used to carry. */}
      <ItWorkspaceTabs />

      <Tabs value={tab} onValueChange={setTab}>
        {/* Nested under the workspace strip — lighter treatment so the two
            levels do not read as one block of tabs. */}
        <TabsList variant="line">
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="licenses">License Utilization</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly" className="mt-4">
          <ItBillingMonthlyTab />
        </TabsContent>
        <TabsContent value="subscriptions" className="mt-4">
          <SubscriptionsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="vendors" className="mt-4">
          <VendorsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="licenses" className="mt-4">
          <LicenseReportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────── Subscriptions ───────────────────────────

function SubscriptionsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<ItSubscription[]>([]);
  const [vendors, setVendors] = useState<ItVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const debounced = useDebounce(search, 350);
  const pagination = usePagination();
  const { setTotalCount, setPage } = pagination;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ItSubscription | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listSubscriptions({
        page: pagination.page,
        limit: pagination.pageSize,
        search: debounced || undefined,
        status:
          status !== "all" ? (status as ItSubscription["status"]) : undefined,
      });
      setRows(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debounced, status, setTotalCount]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    void listVendors()
      .then((r) => setVendors(r.data))
      .catch(() => {});
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this subscription?")) return;
    try {
      await deleteSubscription(id);
      toast.success("Deleted");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete");
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search product or vendor..."
          className="h-9 max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SUBSCRIPTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SUBSCRIPTION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" />
            New Subscription
          </Button>
        )}
      </div>

      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No subscriptions"
        columns={[
          { key: "productName", header: "Product" },
          {
            key: "vendor",
            mobileRole: "subtitle" as const,
            header: "Vendor",
            render: (r) => (
              <span className="text-muted-foreground">{r.vendor.name}</span>
            ),
          },
          {
            key: "renewalDate",
            mobileRole: "field" as const,
            header: "Renewal",
            render: (r) =>
              r.renewalDate
                ? new Date(r.renewalDate).toLocaleDateString("en-GB")
                : "-",
          },
          {
            key: "invoiceAmount",
            mobileRole: "field" as const,
            header: "Invoice",
            render: (r) => `${r.currency} ${r.invoiceAmount.toLocaleString()}`,
          },
          {
            key: "status",
            mobileRole: "badge" as const,
            header: "Status",
            render: (r) => (
              <Badge status={r.effectiveStatus}>
                {SUBSCRIPTION_STATUS_LABELS[r.effectiveStatus]}
              </Badge>
            ),
          },
          {
            key: "actions",
            mobileRole: "actions" as const,
            header: "",
            className: "w-[90px] text-right",
            render: (r) =>
              canManage ? (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(r);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null,
          },
        ]}
        pagination={
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        }
      />

      {dialogOpen && (
        <SubscriptionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          vendors={vendors}
          onSaved={() => {
            setDialogOpen(false);
            void fetchRows();
          }}
        />
      )}
    </div>
  );
}

function SubscriptionDialog({
  open,
  onOpenChange,
  editing,
  vendors,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ItSubscription | null;
  vendors: ItVendor[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SubscriptionInput>({
    vendorId: editing?.vendorId ?? vendors[0]?.id ?? "",
    productName: editing?.productName ?? "",
    category: editing?.category ?? "saas",
    billingFrequency: editing?.billingFrequency ?? "monthly",
    invoiceAmount: editing?.invoiceAmount ?? 0,
    currency: editing?.currency ?? "USD",
    paymentStatus: editing?.paymentStatus ?? "pending",
    status: editing?.status ?? "active",
    renewalDate: editing?.renewalDate ? editing.renewalDate.slice(0, 10) : null,
    contractStartDate: editing?.contractStartDate
      ? editing.contractStartDate.slice(0, 10)
      : null,
    notes: editing?.notes ?? "",
    totalSeats: editing?.totalSeats ?? null,
    assignedSeats: editing?.assignedSeats ?? 0,
    activeSeats: editing?.activeSeats ?? 0,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.vendorId || !form.productName.trim()) {
      toast.error("Vendor and product name are required");
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateSubscription(editing.id, form);
      } else {
        await createSubscription(form);
      }
      toast.success(editing ? "Updated" : "Created");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Subscription" : "New Subscription"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Vendor</Label>
            <Select
              value={form.vendorId}
              onValueChange={(v) => setForm((f) => ({ ...f, vendorId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Product name</Label>
            <Input
              value={form.productName}
              onChange={(e) =>
                setForm((f) => ({ ...f, productName: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Input
                value={form.category ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Billing frequency</Label>
              <Select
                value={form.billingFrequency}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    billingFrequency:
                      v as SubscriptionInput["billingFrequency"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_FREQUENCIES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Invoice amount</Label>
              <Input
                type="number"
                value={form.invoiceAmount ?? 0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    invoiceAmount: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Currency</Label>
              <Input
                value={form.currency ?? "USD"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Contract start</Label>
              <Input
                type="date"
                value={form.contractStartDate ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    contractStartDate: e.target.value || null,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Renewal date</Label>
              <Input
                type="date"
                value={form.renewalDate ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    renewalDate: e.target.value || null,
                  }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Payment status</Label>
              <Select
                value={form.paymentStatus}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    paymentStatus: v as SubscriptionInput["paymentStatus"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    status: v as SubscriptionInput["status"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUBSCRIPTION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* License utilization */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Total seats</Label>
              <Input
                type="number"
                min={0}
                placeholder="-"
                value={form.totalSeats ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    totalSeats:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Assigned</Label>
              <Input
                type="number"
                min={0}
                value={form.assignedSeats ?? 0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    assignedSeats: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Active</Label>
              <Input
                type="number"
                min={0}
                value={form.activeSeats ?? 0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    activeSeats: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>

          {editing && (
            <SubscriptionExtras subscription={editing} onChanged={onSaved} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Attachments + renewal decision for an existing
// subscription. Reuses the shared `uploads` bucket via uploadFile().
function SubscriptionExtras({
  subscription,
  onChanged,
}: {
  subscription: ItSubscription;
  onChanged: () => void;
}) {
  const [attachments, setAttachments] = useState<ItAttachment[]>(
    subscription.attachments ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState("");
  // Cancelling is two-step so the effective date is VISIBLE before it is
  // applied. It defaults to the renewal date — the paid-through date — and that
  // default silently moving a month of spend is exactly what a hidden default
  // would do.
  const [cancelArmed, setCancelArmed] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    subscription.renewalDate ? subscription.renewalDate.slice(0, 10) : "",
  );

  async function onUpload(file: File) {
    try {
      setBusy(true);
      const uploaded = await uploadFile(file, {
        bucket: "uploads",
        purpose: "it-billing",
        linkedId: subscription.id,
      });
      const res = await addSubscriptionAttachment(subscription.id, {
        name: uploaded.originalName,
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        kind: "invoice",
      });
      setAttachments(res.data.attachments);
      toast.success("Attached");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(url: string) {
    try {
      const res = await removeSubscriptionAttachment(subscription.id, url);
      setAttachments(res.data.attachments);
      toast.success("Removed");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Remove failed");
    }
  }

  async function decide(decision: "renew" | "cancel") {
    try {
      setBusy(true);
      await recordRenewalDecision(subscription.id, {
        decision,
        notes: decisionNotes || undefined,
        // Only meaningful for a cancellation; a renew clears the date instead.
        effectiveDate:
          decision === "cancel" && effectiveDate ? effectiveDate : undefined,
      });
      toast.success(
        decision === "renew" ? "Marked renewed" : "Marked cancelled",
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-border mt-1 grid gap-3 border-t pt-3">
      <div className="grid gap-1.5">
        <Label>Documents (contracts, invoices, renewals, quotations)</Label>
        <div className="space-y-1">
          {attachments.length === 0 ? (
            <p className="text-muted-foreground text-xs">No documents yet.</p>
          ) : (
            attachments.map((a) => (
              <div
                key={a.url}
                className="flex items-center justify-between text-xs"
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    text-primary truncate
                    hover:underline
                  `}
                >
                  {a.kind ? `[${a.kind}] ` : ""}
                  {a.name}
                </a>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => onRemove(a.url)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
        <Input
          type="file"
          disabled={busy}
          className="text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Renewal decision</Label>
        {subscription.renewalDecision ? (
          <p className="text-muted-foreground text-xs">
            Decision recorded: <strong>{subscription.renewalDecision}</strong>
            {subscription.renewalDecisionAt
              ? ` on ${new Date(
                  subscription.renewalDecisionAt,
                ).toLocaleDateString("en-GB")}`
              : ""}
            {subscription.cancelledAt
              ? ` · cost stops ${new Date(
                  subscription.cancelledAt,
                ).toLocaleDateString("en-GB")}`
              : ""}
          </p>
        ) : (
          <>
            <Textarea
              placeholder="Reason / notes (optional)"
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
            />
            {cancelArmed && (
              <div className="grid gap-1.5">
                <Label htmlFor="cancel-effective-date">
                  Cost stops after (effective from)
                </Label>
                <Input
                  id="cancel-effective-date"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Defaults to the renewal date, because a term already paid for
                  still costs money until it ends. This is the month the spend
                  trend steps down.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => decide("renew")}>
                Renew
              </Button>
              {cancelArmed ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busy}
                    onClick={() => decide("cancel")}
                  >
                    Confirm cancellation
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setCancelArmed(false)}
                  >
                    Back
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => setCancelArmed(true)}
                >
                  Cancel subscription
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── Vendors ─────────────────────────────

function VendorsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<ItVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ItVendor | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listVendors();
      setRows(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this vendor and all its subscriptions?")) return;
    try {
      await deleteVendor(id);
      toast.success("Deleted");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete");
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" />
            New Vendor
          </Button>
        )}
      </div>
      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No vendors"
        columns={[
          { key: "name", header: "Vendor" },
          {
            key: "contactPerson",
            header: "Contact",
            render: (r) => r.contactPerson ?? "-",
          },
          { key: "email", header: "Email", render: (r) => r.email ?? "-" },
          {
            key: "subscriptionCount",
            header: "Subscriptions",
            className: "text-right",
            render: (r) => r.subscriptionCount,
          },
          {
            key: "actions",
            mobileRole: "actions" as const,
            header: "",
            className: "w-[90px] text-right",
            render: (r) =>
              canManage ? (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(r);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />
      {dialogOpen && (
        <VendorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSaved={() => {
            setDialogOpen(false);
            void fetchRows();
          }}
        />
      )}
    </div>
  );
}

function VendorDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ItVendor | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<VendorInput>({
    name: editing?.name ?? "",
    contactPerson: editing?.contactPerson ?? "",
    email: editing?.email ?? "",
    phone: editing?.phone ?? "",
    notes: editing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateVendor(editing.id, form);
      } else {
        await createVendor(form);
      }
      toast.success(editing ? "Updated" : "Created");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Vendor" : "New Vendor"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Contact person</Label>
            <Input
              value={form.contactPerson ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPerson: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                value={form.email ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────── License Utilization ─────────────────────

function LicenseReportTab() {
  const [rows, setRows] = useState<LicenseUtilizationRow[]>([]);
  const [vendors, setVendors] = useState<ItVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState("all");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("all");

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await licenseUtilizationReport({
        vendorId: vendorId !== "all" ? vendorId : undefined,
        category: category || undefined,
        status: status !== "all" ? (status as SubscriptionStatus) : undefined,
      });
      setRows(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [vendorId, category, status]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    void listVendors()
      .then((r) => setVendors(r.data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={vendorId} onValueChange={setVendorId}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category..."
          className="h-9 w-[160px]"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SUBSCRIPTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SUBSCRIPTION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No seat-based subscriptions match these filters"
        columns={[
          { key: "productName", header: "Software" },
          {
            key: "vendorName",
            mobileRole: "subtitle" as const,
            header: "Vendor",
            render: (r) => (
              <span className="text-muted-foreground">{r.vendorName}</span>
            ),
          },
          {
            key: "totalSeats",
            mobileRole: "detail" as const,
            header: "Purchased",
            className: "text-right",
            render: (r) => r.totalSeats ?? "-",
          },
          {
            key: "assignedSeats",
            mobileRole: "detail" as const,
            header: "Assigned",
            className: "text-right",
            render: (r) => r.assignedSeats,
          },
          {
            key: "activeSeats",
            mobileRole: "detail" as const,
            header: "Active",
            className: "text-right",
            render: (r) => r.activeSeats,
          },
          {
            key: "unusedSeats",
            mobileRole: "detail" as const,
            header: "Unused",
            className: "text-right",
            render: (r) => (
              <span
                className={r.unusedSeats > 0 ? "text-warning font-medium" : ""}
              >
                {r.unusedSeats}
              </span>
            ),
          },
          {
            key: "utilizationPercentage",
            mobileRole: "field" as const,
            header: "Utilization",
            className: "text-right",
            render: (r) =>
              r.utilizationPercentage === null
                ? "-"
                : `${r.utilizationPercentage}%`,
          },
          {
            key: "monthlyCost",
            mobileRole: "field" as const,
            header: "Monthly Cost",
            className: "text-right",
            render: (r) => `${r.currency} ${r.monthlyCost.toLocaleString()}`,
          },
          {
            key: "potentialMonthlySavings",
            mobileRole: "field" as const,
            header: "Potential Savings",
            className: "text-right",
            render: (r) => (
              <span
                className={
                  r.potentialMonthlySavings > 0
                    ? "text-success font-medium"
                    : ""
                }
              >
                {r.currency} {r.potentialMonthlySavings.toLocaleString()}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
