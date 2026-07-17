import { Check, X } from "lucide-react";

import {
  formatLeaveDateRange,
  formatLeaveDays,
} from "@/components/leave/leave-duration";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import type { LeaveRequest } from "@/services/leave.service";

export const ALL_FILTER = "__all__";

export const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getBaseColumns() {
  return [
    {
      key: "leaveType",
      header: "Leave Type",
      render: (r: LeaveRequest) => (
        <span className="font-medium">{r.leaveType.name}</span>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      render: (r: LeaveRequest) => formatLeaveDateRange(r),
    },
    {
      key: "days",
      header: "Days",
      render: (r: LeaveRequest) => (
        <span className="tabular-nums">{formatLeaveDays(r)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r: LeaveRequest) => <Badge status={r.status}>{r.status}</Badge>,
    },
  ];
}

export function getMyColumns(onCancel: (r: LeaveRequest) => void) {
  return [
    ...getBaseColumns(),
    {
      key: "actions",
      header: "",
      className: "w-[80px] text-right",
      // Employees can cancel a still-pending request OR recall an
      // already-approved one — an approved cancel refunds the balance
      // instantly (no second approval). Other statuses have no action.
      render: (r: LeaveRequest) =>
        r.status === "pending" || r.status === "approved" ? (
          <Button
            variant="ghost"
            size="xs"
            className="text-destructive text-xs"
            onClick={() => onCancel(r)}
          >
            <X className="mr-1 size-3" />
            Cancel
          </Button>
        ) : null,
    },
  ];
}

export function getAllColumns(
  canApprove: boolean,
  onApprove: (r: LeaveRequest) => void,
  onReject: (r: LeaveRequest) => void,
) {
  return [
    {
      key: "employee",
      header: "Employee",
      render: (r: LeaveRequest) => (
        <span className="font-medium">{r.employee.name}</span>
      ),
    },
    ...getBaseColumns(),
    {
      key: "actions",
      header: "",
      className: "w-[140px] text-right",
      render: (r: LeaveRequest) =>
        r.status === "pending" && canApprove ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="xs"
              className="text-success text-xs"
              onClick={() => onApprove(r)}
            >
              <Check className="mr-1 size-3" />
              Approve
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive text-xs"
              onClick={() => onReject(r)}
            >
              <X className="mr-1 size-3" />
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];
}
