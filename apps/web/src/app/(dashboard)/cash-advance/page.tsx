"use client";

import { Loader2, Paperclip, Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CashAdvanceDisburseDialog } from "@/components/cash-advance/cash-advance-disburse-dialog";
import { CashAdvanceFormDialog } from "@/components/cash-advance/cash-advance-form-dialog";
import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  approveCashAdvance,
  CASH_ADVANCE_STATUS_LABELS,
  type CashAdvanceRequest,
  type CashAdvanceStatus,
  clearCashAdvance,
  deleteCashAdvance,
  getCashAdvanceDisbursementProofUrl,
  getCashAdvanceItemReceiptUrl,
  listCashAdvances,
  rejectCashAdvance,
  submitCashAdvance,
  withdrawCashAdvance,
} from "@/services/cash-advance.service";

const STATUS_TONE: Record<
  CashAdvanceStatus,
  "grey" | "blue" | "green" | "red" | "amber" | "gold"
> = {
  draft: "grey",
  submitted: "blue",
  approved: "amber",
  rejected: "red",
  disbursed: "gold",
  cleared: "green",
};

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "THB",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function CashAdvancePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const canCreate = hasPermission("cash-advance:create");
  const canApprove = hasPermission("cash-advance:approve");
  const canSeeAll = hasAnyPermission(
    "cash-advance:read-all",
    "cash-advance:approve",
  );

  const [tab, setTab] = useTabParam(canSeeAll ? "all" : "mine");
  const [rows, setRows] = useState<CashAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CashAdvanceRequest | null>(null);
  const [disbursing, setDisbursing] = useState<CashAdvanceRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCashAdvances({
        scope: tab === "all" && canSeeAll ? "all" : "mine",
        limit: 50,
      });
      setRows(res.data);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, canSeeAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = useCallback((req: CashAdvanceRequest) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === req.id);
      if (idx === -1) return [req, ...prev];
      const next = [...prev];
      next[idx] = req;
      return next;
    });
    setEditing(null);
  }, []);

  async function handleSubmit(req: CashAdvanceRequest) {
    try {
      const res = await submitCashAdvance(req.id);
      onSaved(res.data);
      toast.success("Submitted for review");
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  async function handleWithdraw(req: CashAdvanceRequest) {
    try {
      const res = await withdrawCashAdvance(req.id);
      onSaved(res.data);
      toast.success("Unsubmitted — you can edit and resubmit");
      // Reopen the edit dialog on the now-draft request so the owner can
      // adjust details straight away (onSaved just cleared it).
      setEditing(res.data);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  async function handleApprove(req: CashAdvanceRequest) {
    // Default approved = requested for every line. Finance can edit
    // later via the form-dialog before disburse.
    try {
      const res = await approveCashAdvance(req.id, {
        items: req.items.map((it) => ({
          id: it.id,
          approvedAmount: it.requestedAmount,
        })),
      });
      onSaved(res.data);
      toast.success("Approved");
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  async function handleReject(req: CashAdvanceRequest) {
    const reason = prompt("Reason for rejection?");
    if (!reason?.trim()) return;
    try {
      const res = await rejectCashAdvance(req.id, reason.trim());
      onSaved(res.data);
      toast.success("Rejected");
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  function handleViewProof(req: CashAdvanceRequest) {
    const popup = window.open("about:blank", "_blank");
    getCashAdvanceDisbursementProofUrl(req.id)
      .then((res) => {
        if (popup && !popup.closed) popup.location.href = res.data.url;
        else window.location.href = res.data.url;
      })
      .catch((err) => {
        popup?.close();
        if (err instanceof ApiError) toast.error(err.message);
        else toast.error("Could not open disbursement proof");
      });
  }

  // Line-item receipts live in the private `receipts` bucket, so the stored
  // URL is unreachable — mint a fresh signed one on click. Opening a blank
  // tab first keeps the popup blocker happy while the request is in flight.
  function handleViewReceipt(requestId: string, itemId: string) {
    const popup = window.open("about:blank", "_blank");
    getCashAdvanceItemReceiptUrl(requestId, itemId)
      .then((res) => {
        if (popup && !popup.closed) popup.location.href = res.data.url;
        else window.location.href = res.data.url;
      })
      .catch((err) => {
        popup?.close();
        if (err instanceof ApiError) toast.error(err.message);
        else toast.error("Could not open receipt");
      });
  }

  async function handleClear(req: CashAdvanceRequest) {
    try {
      const res = await clearCashAdvance(req.id);
      onSaved(res.data);
      toast.success("Cleared");
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  async function handleDelete(req: CashAdvanceRequest) {
    if (
      !confirm(
        `Remove request CA-${req.requestNumber}? It will no longer appear in the Cash Advance lists.`,
      )
    ) {
      return;
    }
    try {
      await deleteCashAdvance(req.id);
      setRows((prev) => prev.filter((r) => r.id !== req.id));
      toast.success("Removed");
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  // Receipts attached to the request's line items. Visible at every status to
  // anyone who can already see the row (the owner or an approver) — the
  // receipt route re-checks that server-side before signing a URL.
  const renderAttachments = (req: CashAdvanceRequest) => {
    const withReceipts = req.items.filter((it) => it.receiptUrl);
    if (withReceipts.length === 0) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    if (withReceipts.length === 1) {
      const only = withReceipts[0]!;
      return (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          title={`View receipt — ${only.description || "line item"}`}
          aria-label={`View receipt for CA-${req.requestNumber}`}
          onClick={() => handleViewReceipt(req.id, only.id)}
        >
          <Paperclip className="size-3.5" />
        </Button>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2"
            aria-label={`View ${withReceipts.length} receipts for CA-${req.requestNumber}`}
          >
            <Paperclip className="size-3.5" />
            <span className="text-[11px] tabular-nums">
              {withReceipts.length}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            Receipts
          </DropdownMenuLabel>
          {withReceipts.map((it) => (
            <DropdownMenuItem
              key={it.id}
              onSelect={() => handleViewReceipt(req.id, it.id)}
            >
              <Paperclip className="size-3.5 shrink-0" />
              <span className="truncate">{it.description || "Line item"}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderActions = (req: CashAdvanceRequest) => {
    const isOwner = req.employeeId === user?.id;
    const actions: Array<{
      label: string;
      onClick: () => void;
      tone?: string;
    }> = [];
    if (isOwner && (req.status === "draft" || req.status === "rejected")) {
      actions.push({ label: "Edit", onClick: () => setEditing(req) });
      actions.push({ label: "Submit", onClick: () => void handleSubmit(req) });
    }
    if (isOwner && req.status === "submitted") {
      actions.push({
        label: "Unsubmit",
        onClick: () => void handleWithdraw(req),
      });
    }
    if (canApprove && req.status === "submitted") {
      actions.push({
        label: "Approve",
        onClick: () => void handleApprove(req),
      });
      actions.push({
        label: "Reject",
        onClick: () => void handleReject(req),
        tone: "destructive",
      });
    }
    if (canApprove && req.status === "approved") {
      actions.push({
        label: "Mark disbursed",
        onClick: () => setDisbursing(req),
      });
    }
    if (
      canApprove &&
      (req.status === "disbursed" || req.status === "cleared") &&
      req.disbursementProofUrl
    ) {
      actions.push({
        label: "View proof",
        onClick: () => handleViewProof(req),
      });
    }
    if (canApprove && req.status === "disbursed") {
      actions.push({
        label: "Mark cleared",
        onClick: () => void handleClear(req),
      });
    }
    // Owner may remove their own draft; an approver (HR / Finance / Accounting
    // manager, cash-advance:approve) may remove any request at any status —
    // e.g. purging a stale approved line. The DELETE route soft-deletes and
    // re-checks owner-or-approve, so this button is a display gate only.
    const canRemove = canApprove || (isOwner && req.status === "draft");
    if (canRemove) {
      actions.push({
        label: "Remove",
        onClick: () => void handleDelete(req),
        tone: "destructive",
      });
    }
    return (
      <div className="flex flex-wrap justify-end gap-1">
        {actions.map((a) => (
          <Button
            key={a.label}
            type="button"
            size="sm"
            variant={a.tone === "destructive" ? "destructive" : "outline"}
            className="h-7 px-2 text-[11px]"
            onClick={a.onClick}
          >
            {a.label}
          </Button>
        ))}
      </div>
    );
  };

  const table = useMemo(
    () => (
      <div className="bg-card overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">No.</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Requested</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[90px] text-center">Attachment</TableHead>
              <TableHead className="w-[260px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <Loader2
                    className={`
                      text-muted-foreground mx-auto h-5 w-5 animate-spin
                    `}
                  />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-muted-foreground py-12 text-center text-sm"
                >
                  No cash advance requests yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    CA-{r.requestNumber}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.employee.name}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {r.department ?? r.employee.department ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {r.requestDate}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.payoutMode === "cash" ? "Cash" : "Bank transfer"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(r.requestedTotal, r.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.approvedTotal > 0
                      ? fmtMoney(r.approvedTotal, r.currency)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[r.status]}>
                      {CASH_ADVANCE_STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {renderAttachments(r)}
                  </TableCell>
                  <TableCell>{renderActions(r)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    ),
    // renderActions captures state — re-render is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, loading, canApprove, user?.id],
  );

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Cash Advance"
        subtitle="Request cash advance against future salary. HR / Finance reviews each line."
      >
        {canApprove && (
          <Button variant="outline" asChild>
            <Link href="/cash-advance/approval">
              <SlidersHorizontal className="mr-1 size-4" />
              Approval chain
            </Link>
          </Button>
        )}
        {canCreate && (
          <PermissionButton
            permission="cash-advance:create"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1 size-4" />
            New request
          </PermissionButton>
        )}
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="mine">My requests</TabsTrigger>
          {canSeeAll && <TabsTrigger value="all">All requests</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine">{table}</TabsContent>
        {canSeeAll && <TabsContent value="all">{table}</TabsContent>}
      </Tabs>

      <CashAdvanceFormDialog
        open={createOpen || editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        onSaved={onSaved}
        editing={editing}
        defaults={{
          department: user?.department ?? null,
          position: user?.jobTitle ?? null,
        }}
      />

      <CashAdvanceDisburseDialog
        open={disbursing !== null}
        onOpenChange={(next) => {
          if (!next) setDisbursing(null);
        }}
        request={disbursing}
        onDisbursed={onSaved}
      />
    </div>
  );
}
