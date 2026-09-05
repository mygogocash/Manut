"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AttendanceCorrectionDialog } from "@/components/hrms/attendance-correction-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import {
  approveAttendanceCorrection,
  type AttendanceCorrection,
  listAttendanceCorrections,
  rejectAttendanceCorrection,
} from "@/services/attendance-phase2.service";

export function AttendanceCorrectionsPanel({
  canRequest,
  canApprove,
}: {
  canRequest: boolean;
  canApprove: boolean;
}) {
  const [rows, setRows] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"mine" | "team" | "all">(
    canApprove ? "team" : "mine",
  );
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const pag = usePagination();

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAttendanceCorrections({
        page: pag.page,
        limit: pag.pageSize,
        scope,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      pag.setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load corrections",
      );
    } finally {
      setLoading(false);
    }
  }, [pag.page, pag.pageSize, scope, statusFilter, pag.setTotalCount]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function handleApprove(id: string) {
    try {
      setActingId(id);
      await approveAttendanceCorrection(id);
      toast.success("Correction approved");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Approve failed");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(id: string) {
    const remarks = window.prompt("Rejection remarks:");
    if (!remarks?.trim()) return;
    try {
      setActingId(id);
      await rejectAttendanceCorrection(id, remarks.trim());
      toast.success("Correction rejected");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Reject failed");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {canApprove ? (
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as typeof scope)}
            >
              <SelectTrigger className="w-[140px]" aria-label="Correction scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">My Requests</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <Select
            value={statusFilter || "__all__"}
            onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canRequest ? (
          <Button onClick={() => setDialogOpen(true)}>
            Request Correction
          </Button>
        ) : null}
      </div>

      <DataTable
        loading={loading}
        emptyMessage="No correction requests"
        columns={[
          { key: "date", header: "Date", render: (r) => r.attendanceDate },
          {
            key: "employee",
            mobileRole: "subtitle" as const,
            header: "Employee",
            render: (r) => r.employee?.name ?? "—",
          },
          {
            key: "type",
            mobileRole: "field" as const,
            header: "Type",
            render: (r) => r.correctionType.replace(/_/g, " "),
          },
          { key: "reason", mobileRole: "detail" as const, header: "Reason", render: (r) => r.reason },
          {
            key: "status",
            mobileRole: "badge" as const,
            header: "Status",
            render: (r) => (
              <Badge
                variant={
                  r.status === "approved"
                    ? "green"
                    : r.status === "rejected"
                      ? "red"
                      : "amber"
                }
              >
                {r.status}
              </Badge>
            ),
          },
          {
            key: "actions",
            mobileRole: "actions" as const,
            header: "",
            render: (r) =>
              canApprove && r.status === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === r.id}
                    onClick={() => void handleApprove(r.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actingId === r.id}
                    onClick={() => void handleReject(r.id)}
                  >
                    Reject
                  </Button>
                </div>
              ) : null,
          },
        ]}
        data={rows}
      />
      <DataPagination
        page={pag.page}
        pageSize={pag.pageSize}
        totalCount={pag.totalCount}
        totalPages={pag.totalPages}
        onPageChange={pag.setPage}
        onPageSizeChange={pag.setPageSize}
      />

      {canRequest ? (
        <AttendanceCorrectionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={() => void fetchRows()}
        />
      ) : null}
    </div>
  );
}
