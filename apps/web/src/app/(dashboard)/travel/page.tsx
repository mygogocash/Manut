"use client";

import {
  Check,
  Download,
  Loader2,
  Plane,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { TravelRequestDetailSheet } from "@/components/travel/travel-detail-sheet";
import { TravelRequestDialog } from "@/components/travel/travel-request-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  approveTravelRequest,
  cancelTravelRequest,
  deleteTravelRequest,
  downloadTravelExport,
  listTravelRequests,
  rejectTravelRequest,
  type TravelRequest,
} from "@/services/travel.service";

const DELETABLE_STATUSES = new Set([
  "draft",
  "pending",
  "cancelled",
  "rejected",
]);

const ALL_FILTER = "__all__";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBudget(amount: string | null, currency: string) {
  if (!amount) return "-";
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(num);
}

export default function TravelPage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  const canRequest = hasPermission("travel:request");
  const canApprove = hasAnyPermission("travel:approve", "travel:hr-approve");
  const canViewAll = hasAnyPermission("travel:hr-read");
  const canExport = hasAnyPermission("travel:export", "travel:hr-read");
  const canManageApprovals = hasPermission("travel:hr-settings");

  const [activeTab, setActiveTab] = useState("my");

  const [myRequests, setMyRequests] = useState<TravelRequest[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);
  const myPagination = usePagination();
  const {
    page: myPage,
    pageSize: myPageSize,
    setTotalCount: setMyTotalCount,
  } = myPagination;

  const [allRequests, setAllRequests] = useState<TravelRequest[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const allPagination = usePagination();
  const {
    page: allPage,
    pageSize: allPageSize,
    setPage: setAllPage,
    setTotalCount: setAllTotalCount,
  } = allPagination;

  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [travelDialogOpen, setTravelDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TravelRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailRequest, setDetailRequest] = useState<TravelRequest | null>(
    null,
  );

  const fetchMyRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadingMy(true);
      const result = await listTravelRequests({
        page: myPage,
        limit: myPageSize,
        employeeId: user.id,
      });
      setMyRequests(result.data);
      setMyTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load travel requests";
      toast.error(msg);
    } finally {
      setLoadingMy(false);
    }
  }, [user?.id, myPage, myPageSize, setMyTotalCount]);

  const fetchAllRequests = useCallback(async () => {
    if (!canViewAll) return;
    try {
      setLoadingAll(true);
      const result = await listTravelRequests({
        page: allPage,
        limit: allPageSize,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      });
      setAllRequests(result.data);
      setAllTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load travel requests";
      toast.error(msg);
    } finally {
      setLoadingAll(false);
    }
  }, [
    canViewAll,
    allPage,
    allPageSize,
    statusFilter,
    debouncedSearch,
    setAllTotalCount,
  ]);

  useEffect(() => {
    void fetchMyRequests();
  }, [fetchMyRequests]);

  useEffect(() => {
    if (activeTab === "all") void fetchAllRequests();
  }, [activeTab, fetchAllRequests]);

  useEffect(() => {
    setAllPage(1);
  }, [statusFilter, debouncedSearch, setAllPage]);

  const refreshAll = useCallback(() => {
    void fetchMyRequests();
    void fetchAllRequests();
  }, [fetchMyRequests, fetchAllRequests]);

  async function handleApprove(id: string) {
    try {
      await approveTravelRequest(id);
      toast.success("Travel request approved");
      refreshAll();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to approve";
      toast.error(msg);
    }
  }

  function openRejectDialog(id: string) {
    setRejectTarget(id);
    setRejectReason("");
  }

  async function handleRejectConfirm() {
    if (!rejectTarget || !rejectReason.trim()) return;
    try {
      setRejecting(true);
      await rejectTravelRequest(rejectTarget, rejectReason.trim());
      toast.success("Travel request rejected");
      setRejectTarget(null);
      refreshAll();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to reject";
      toast.error(msg);
    } finally {
      setRejecting(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelTravelRequest(id);
      toast.success("Travel request cancelled");
      void fetchMyRequests();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to cancel";
      toast.error(msg);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteTravelRequest(deleteTarget.id);
      toast.success("Travel request deleted");
      setDeleteTarget(null);
      void fetchMyRequests();
      if (canViewAll) void fetchAllRequests();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  const handleExportTravel = async () => {
    try {
      await downloadTravelExport({
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
      });
    } catch {
      toast.error("Export failed");
    }
  };

  const tabsList = useMemo(() => {
    const tabs = [{ id: "my", label: "My Travel" }];
    if (canViewAll) tabs.push({ id: "all", label: "All Requests" });
    return tabs;
  }, [canViewAll]);

  const baseColumns = [
    {
      key: "code",
      header: "Code",
      render: (r: TravelRequest) => (
        <span className="font-mono text-xs">{r.requestCode}</span>
      ),
    },
    {
      key: "route",
      header: "Route",
      render: (r: TravelRequest) => (
        <span className="font-medium">
          {r.origin ? `${r.origin} → ${r.destination}` : r.destination}
        </span>
      ),
    },
    {
      key: "purpose",
      header: "Purpose",
      render: (r: TravelRequest) => (
        <span className="max-w-[200px] truncate">{r.purpose}</span>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      render: (r: TravelRequest) =>
        `${formatDate(r.departureDate)} – ${formatDate(r.returnDate)}`,
    },
    {
      key: "budget",
      header: "Budget",
      render: (r: TravelRequest) => (
        <span className="tabular-nums">
          {formatBudget(r.estimatedBudget, r.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r: TravelRequest) => (
        <Badge
          status={
            r.status === "approved"
              ? "approved"
              : r.status === "rejected" || r.status === "cancelled"
                ? "rejected"
                : "pending"
          }
        >
          {r.status}
        </Badge>
      ),
    },
  ];

  const myColumns = [
    ...baseColumns,
    {
      key: "actions",
      header: "",
      className: "w-[160px] text-right",
      render: (r: TravelRequest) => {
        const canCancel = r.status === "pending" || r.status === "draft";
        const canDelete = DELETABLE_STATUSES.has(r.status);
        if (!canCancel && !canDelete) return null;
        return (
          <div className="flex items-center justify-end gap-1">
            {canCancel && (
              <Button
                variant="ghost"
                size="xs"
                className="text-destructive text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel(r.id);
                }}
              >
                Cancel
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="xs"
                className="text-destructive text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(r);
                }}
                aria-label="Delete travel request"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const allColumns = [
    {
      key: "employee",
      header: "Employee",
      render: (r: TravelRequest) => (
        <span className="font-medium">{r.employee.name}</span>
      ),
    },
    ...baseColumns,
    {
      key: "actions",
      header: "",
      className: "w-[200px] text-right",
      render: (r: TravelRequest) => {
        const showApprove =
          r.status === "pending" && (canApprove || r.viewerCanAct);
        // HR (canViewAll → has travel:hr-read) can delete any status.
        const showDelete = canViewAll;
        if (!showApprove && !showDelete) return null;
        return (
          <div className="flex items-center justify-end gap-1">
            {showApprove && (
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-success text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApprove(r.id);
                  }}
                >
                  <Check className="mr-1 size-3" />
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-destructive text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRejectDialog(r.id);
                  }}
                >
                  <X className="mr-1 size-3" />
                  Reject
                </Button>
              </>
            )}
            {showDelete && (
              <Button
                variant="ghost"
                size="xs"
                className="text-destructive text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(r);
                }}
                aria-label="Delete travel request"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Travel Management"
        subtitle="Submit and track travel requests"
      >
        {canManageApprovals && (
          <Button variant="outline" asChild>
            <Link href="/travel/approval">
              <Settings2 className="size-3.5" />
              Approval chain
            </Link>
          </Button>
        )}
        {canRequest && (
          <Button onClick={() => setTravelDialogOpen(true)}>
            <Plane className="size-3.5" />
            New Travel Request
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4">
        <Tabs tabs={tabsList} active={activeTab} onChange={setActiveTab}>
          <TabsContent value="my">
            <DataTable
              columns={myColumns}
              data={myRequests}
              loading={loadingMy}
              emptyMessage="You have no travel requests"
              onRowClick={(r) => setDetailRequest(r)}
              pagination={
                <DataPagination
                  page={myPagination.page}
                  pageSize={myPagination.pageSize}
                  totalCount={myPagination.totalCount}
                  totalPages={myPagination.totalPages}
                  onPageChange={myPagination.setPage}
                  onPageSizeChange={myPagination.setPageSize}
                />
              }
            />
          </TabsContent>

          {canViewAll && (
            <TabsContent value="all">
              <div
                className={`
                  mb-3 flex flex-col gap-2
                  sm:flex-row sm:items-center
                `}
              >
                <div className="relative flex-1">
                  <Search
                    className={`
                      text-muted-foreground absolute top-1/2 left-2.5 size-3.5
                      -translate-y-1/2
                    `}
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by employee, origin or destination..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 min-w-[140px] text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canExport && (
                  <Button
                    variant="outline"
                    onClick={() => void handleExportTravel()}
                  >
                    <Download className="size-3.5" />
                    <span
                      className={`
                        hidden
                        sm:inline
                      `}
                    >
                      Export XLSX
                    </span>
                  </Button>
                )}
              </div>
              <DataTable
                columns={allColumns}
                data={allRequests}
                loading={loadingAll}
                emptyMessage="No travel requests found"
                onRowClick={(r) => setDetailRequest(r)}
                pagination={
                  <DataPagination
                    page={allPagination.page}
                    pageSize={allPagination.pageSize}
                    totalCount={allPagination.totalCount}
                    totalPages={allPagination.totalPages}
                    onPageChange={allPagination.setPage}
                    onPageSizeChange={allPagination.setPageSize}
                  />
                }
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <TravelRequestDialog
        open={travelDialogOpen}
        onOpenChange={setTravelDialogOpen}
        onCreated={refreshAll}
      />

      <TravelRequestDetailSheet
        request={detailRequest}
        open={!!detailRequest}
        onOpenChange={(next) => {
          if (!next) setDetailRequest(null);
        }}
        onDeleted={() => {
          setDetailRequest(null);
          void fetchMyRequests();
          if (canViewAll) void fetchAllRequests();
        }}
      />

      <AlertDialog
        open={!!rejectTarget}
        onOpenChange={(next) => {
          if (!rejecting && !next) setRejectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Travel Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this travel request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejecting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={rejecting || !rejectReason.trim()}
              onClick={handleRejectConfirm}
            >
              {rejecting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Reject
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!deleting && !next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete travel request?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently delete{" "}
                  <span className="font-mono text-xs">
                    {deleteTarget.requestCode}
                  </span>{" "}
                  and its approval history. Linked expenses stay but lose the
                  travel link. This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteConfirm}
            >
              {deleting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
