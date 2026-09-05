"use client";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Receipt,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteTravelRequest,
  FLIGHT_TYPE_LABELS,
  getTravelApprovals,
  HOTEL_LOCATION_PREFERENCE_LABELS,
  listLinkedExpenses,
  SEATING_PREFERENCE_LABELS,
  type TravelApprovalDecision,
  type TravelLinkedExpense,
  type TravelRequest,
} from "@/services/travel.service";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBudget(amount: string | null, currency: string) {
  if (!amount) return "—";
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(num);
}

function statusVariant(status: string): "approved" | "rejected" | "pending" {
  if (
    status === "approved" ||
    status === "completed" ||
    status === "reimbursed"
  ) {
    return "approved";
  }
  if (status === "rejected" || status === "cancelled") return "rejected";
  return "pending";
}

const expenseColumns = [
  {
    key: "date",
    mobileRole: "subtitle" as const,
    header: "Date",
    render: (e: TravelLinkedExpense) => (
      <span className="text-xs tabular-nums">{formatDate(e.date)}</span>
    ),
  },
  {
    key: "description",
    mobileRole: "title" as const,
    header: "Description",
    render: (e: TravelLinkedExpense) => (
      <span className="text-sm">{e.description}</span>
    ),
  },
  {
    key: "amount",
    mobileRole: "field" as const,
    header: "Amount",
    className: "text-right",
    render: (e: TravelLinkedExpense) => (
      <span className="tabular-nums">{formatBudget(e.amount, e.currency)}</span>
    ),
  },
  {
    key: "status",
    mobileRole: "badge" as const,
    header: "Status",
    render: (e: TravelLinkedExpense) => (
      <Badge status={statusVariant(e.status)}>{e.status}</Badge>
    ),
  },
];

interface TravelRequestDetailSheetProps {
  request: TravelRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

const SUBMITTER_DELETABLE = new Set([
  "draft",
  "pending",
  "cancelled",
  "rejected",
]);

export function TravelRequestDetailSheet({
  request,
  open,
  onOpenChange,
  onDeleted,
}: TravelRequestDetailSheetProps) {
  const { user, hasPermission } = useAuth();
  const [expenses, setExpenses] = useState<TravelLinkedExpense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<TravelApprovalDecision[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isHr = hasPermission("travel:hr-read");
  const isOwner = !!user && !!request && request.employee.id === user.id;
  // HR can hard-delete anything; submitter only pre-approval states.
  const canDelete =
    !!request && (isHr || (isOwner && SUBMITTER_DELETABLE.has(request.status)));

  async function handleDelete() {
    if (!request) return;
    try {
      setDeleting(true);
      await deleteTravelRequest(request.id);
      toast.success(`Travel request ${request.requestCode} deleted`);
      setConfirmDelete(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  const fetchExpenses = useCallback(async (id: string) => {
    try {
      setLoadingExpenses(true);
      setExpensesError(null);
      const result = await listLinkedExpenses(id);
      setExpenses(result.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load linked expenses";
      setExpensesError(msg);
      toast.error(msg);
    } finally {
      setLoadingExpenses(false);
    }
  }, []);

  const fetchApprovals = useCallback(async (id: string) => {
    try {
      setLoadingApprovals(true);
      const result = await getTravelApprovals(id);
      setApprovals(result.data);
    } catch {
      setApprovals([]);
    } finally {
      setLoadingApprovals(false);
    }
  }, []);

  useEffect(() => {
    if (open && request) {
      void fetchExpenses(request.id);
      void fetchApprovals(request.id);
    }
    if (!open) {
      setExpenses([]);
      setExpensesError(null);
      setApprovals([]);
    }
  }, [open, request, fetchExpenses, fetchApprovals]);

  const totalLinked = expenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={`
          flex w-full flex-col
          sm:max-w-2xl
          lg:max-w-3xl
        `}
      >
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SheetTitle className="font-mono text-xs">
                {request?.requestCode ?? "—"}
              </SheetTitle>
              {request && (
                <Badge status={statusVariant(request.status)}>
                  {request.status}
                </Badge>
              )}
            </div>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1 size-3.5" />
                Delete
              </Button>
            )}
          </div>
          <SheetDescription>
            {request
              ? `${request.origin ? `${request.origin} → ` : ""}${request.destination} — ${request.employee.name}`
              : "Loading details…"}
          </SheetDescription>
        </SheetHeader>

        {request && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <div
              className={`
                border-border bg-surface-secondary/50 grid grid-cols-2 gap-x-6
                gap-y-3 rounded-lg border p-4 text-sm
                sm:grid-cols-4
              `}
            >
              <Field label="Employee" value={request.employee.name} />
              <Field
                label="Department"
                value={request.employee.department ?? "—"}
              />
              <Field label="Entity" value={request.entity?.name ?? "—"} />
              <Field
                label="Flight"
                value={
                  request.flightType
                    ? FLIGHT_TYPE_LABELS[request.flightType]
                    : "—"
                }
              />
              <Field label="From" value={request.origin ?? "—"} />
              <Field label="To" value={request.destination} />
              <Field
                label="Departure"
                value={formatDate(request.departureDate)}
              />
              <Field label="Return" value={formatDate(request.returnDate)} />
              <Field
                label="Budget"
                value={formatBudget(request.estimatedBudget, request.currency)}
              />
              <Field
                label="Cash advance"
                value={
                  request.cashAdvance
                    ? formatBudget(request.cashAdvance, request.currency)
                    : "—"
                }
              />
              <Field
                label="Hotel"
                value={request.hotelRequired ? "Required" : "Not required"}
              />
              <Field
                label="Visa needed"
                value={request.visaRequired ? "Yes" : "No"}
              />
              <Field
                label="Dummy ticket"
                value={request.dummyTicketRequired ? "Yes" : "No"}
              />
              {request.seatingPreference && (
                <Field
                  label="Seat"
                  value={
                    request.seatingPreference === "other"
                      ? (request.seatingPreferenceOther ??
                        SEATING_PREFERENCE_LABELS.other)
                      : SEATING_PREFERENCE_LABELS[request.seatingPreference]
                  }
                />
              )}
              {request.departureTimePreference && (
                <Field
                  label="Departure time"
                  value={request.departureTimePreference}
                />
              )}
              {request.returnTimePreference && (
                <Field
                  label="Return time"
                  value={request.returnTimePreference}
                />
              )}
              {request.mealPreference && (
                <Field label="Meal" value={request.mealPreference} />
              )}
            </div>

            <div className="text-sm">
              <SectionLabel>Purpose</SectionLabel>
              <p className="text-foreground-secondary mt-1 whitespace-pre-wrap">
                {request.purpose}
              </p>
            </div>

            {request.hotelRequired && (
              <div
                className={`
                  border-border bg-surface-secondary/30 space-y-2 rounded-lg
                  border p-3 text-sm
                `}
              >
                <SectionLabel>
                  <Building2 className="mr-1 inline size-3" />
                  Hotel details
                </SectionLabel>
                {(request.hotelLocationPreference ||
                  request.preferredHotel) && (
                  <div
                    className={`
                      text-foreground-secondary flex flex-wrap gap-x-4 gap-y-1
                      text-xs
                    `}
                  >
                    {request.hotelLocationPreference && (
                      <span>
                        <span className="text-muted-foreground">Location:</span>{" "}
                        {
                          HOTEL_LOCATION_PREFERENCE_LABELS[
                            request.hotelLocationPreference
                          ]
                        }
                      </span>
                    )}
                    {request.preferredHotel && (
                      <span>
                        <span className="text-muted-foreground">Hotel:</span>{" "}
                        {request.preferredHotel}
                      </span>
                    )}
                  </div>
                )}
                <p className={`text-foreground-secondary whitespace-pre-wrap`}>
                  {request.hotelDetails?.trim() || (
                    <span className="text-muted-foreground italic">
                      Hotel required, no further details provided
                    </span>
                  )}
                </p>
              </div>
            )}

            {request.notes && (
              <div className="text-sm">
                <SectionLabel>Notes</SectionLabel>
                <p
                  className={`
                    text-foreground-secondary mt-1 whitespace-pre-wrap
                  `}
                >
                  {request.notes}
                </p>
              </div>
            )}

            {request.status === "rejected" && request.rejectReason && (
              <div
                className={`
                  border-destructive/30 bg-destructive/5 rounded-lg border p-3
                  text-sm
                `}
              >
                <SectionLabel>Reject reason</SectionLabel>
                <p
                  className={`
                    text-foreground-secondary mt-1 whitespace-pre-wrap
                  `}
                >
                  {request.rejectReason}
                </p>
              </div>
            )}

            {request.approver && request.approvedAt && (
              <div className="text-muted-foreground text-xs">
                {request.status === "rejected" ? "Rejected" : "Approved"} by{" "}
                <span className="text-foreground font-medium">
                  {request.approver.name}
                </span>{" "}
                on {formatDate(request.approvedAt)}
              </div>
            )}

            {(loadingApprovals || approvals.length > 0) && (
              <div>
                <SectionLabel>Approval chain</SectionLabel>
                {loadingApprovals ? (
                  <div
                    className={`
                      text-muted-foreground mt-2 flex items-center gap-2 text-xs
                    `}
                  >
                    <Spinner className="size-3.5" />
                    Loading…
                  </div>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {approvals.map((d) => (
                      <li
                        key={d.id}
                        className={`
                          border-border bg-surface-secondary/30 flex items-start
                          gap-3 rounded-md border p-3 text-sm
                        `}
                      >
                        <ApprovalIcon status={d.status} />
                        <div className="flex-1">
                          <div
                            className={`flex items-center justify-between gap-2`}
                          >
                            <span className="font-medium">
                              {d.order}. {d.name}
                            </span>
                            <span
                              className={`
                                text-muted-foreground text-[10px] tracking-wider
                                uppercase
                              `}
                            >
                              {d.status}
                            </span>
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-xs">
                            {approverLabel(d)}
                          </div>
                          {d.decidedBy && d.decidedAt && (
                            <div className="text-muted-foreground mt-1 text-xs">
                              {d.status === "approved"
                                ? "Approved"
                                : d.status === "rejected"
                                  ? "Rejected"
                                  : "Decided"}{" "}
                              by{" "}
                              <span className="text-foreground font-medium">
                                {d.decidedBy.name}
                              </span>{" "}
                              on {formatDate(d.decidedAt)}
                            </div>
                          )}
                          {d.notes && (
                            <div
                              className={`
                                text-foreground-secondary mt-1 text-xs
                                whitespace-pre-wrap
                              `}
                            >
                              {d.notes}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <SectionLabel>
                  <Receipt className="mr-1 inline size-3" />
                  Linked expenses
                </SectionLabel>
                {!loadingExpenses && expenses.length > 0 && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {expenses.length} item{expenses.length === 1 ? "" : "s"} ·{" "}
                    {formatBudget(totalLinked.toFixed(2), request.currency)}
                  </span>
                )}
              </div>

              {loadingExpenses && (
                <div className="flex items-center justify-center py-6">
                  <span
                    className={`
                      text-muted-foreground inline-flex items-center gap-2
                      text-xs
                    `}
                  >
                    <Spinner className="size-3.5" />
                    Loading…
                  </span>
                </div>
              )}

              {expensesError && !loadingExpenses && (
                <div
                  className={`
                    text-destructive flex items-center gap-2 py-3 text-xs
                  `}
                >
                  <AlertCircle className="size-3.5" />
                  {expensesError}
                </div>
              )}

              {!loadingExpenses && !expensesError && (
                <DataTable
                  columns={expenseColumns}
                  data={expenses}
                  emptyMessage="No expenses linked to this trip"
                />
              )}
            </div>
          </div>
        )}
      </SheetContent>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => !deleting && setConfirmDelete(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete travel request?</AlertDialogTitle>
            <AlertDialogDescription>
              {request &&
                `${request.requestCode} (${request.destination}) will be removed permanently.${
                  request.status === "approved" ||
                  request.status === "completed"
                    ? " This request is already approved — deleting it removes the audit trail."
                    : ""
                }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className={`
                bg-destructive text-destructive-foreground
                hover:bg-destructive/90
              `}
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function approverLabel(d: TravelApprovalDecision): string {
  if (d.approverType === "manager") return "Submitter's manager";
  if (d.approverUser) {
    return `${d.approverUser.name} — ${d.approverUser.email}`;
  }
  return "Approver removed";
}

function ApprovalIcon({
  status,
}: {
  status: TravelApprovalDecision["status"];
}) {
  if (status === "approved") {
    return <CheckCircle2 className="text-success mt-0.5 size-4" />;
  }
  if (status === "rejected") {
    return <XCircle className="text-destructive mt-0.5 size-4" />;
  }
  if (status === "pending") {
    return <Clock className="text-muted-foreground mt-0.5 size-4" />;
  }
  return <Circle className="text-muted-foreground mt-0.5 size-4" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={`
        text-muted-foreground text-[10px] font-bold tracking-wider uppercase
      `}
    >
      {children}
    </p>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p
        className={`
          text-muted-foreground text-[10px] font-bold tracking-wider uppercase
        `}
      >
        {label}
      </p>
      <p
        className={`
          text-foreground mt-0.5
          ${className ?? ""}
        `}
      >
        {value}
      </p>
    </div>
  );
}
