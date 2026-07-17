import type { LeaveRequest } from "@manut/app-core";

function formatRange(request: LeaveRequest): string {
  if (request.startDate === request.endDate) {
    return request.startDate;
  }
  return `${request.startDate} – ${request.endDate}`;
}

/**
 * Confirm copy for cancelling a leave request.
 * Approved cancellations refund balance immediately; pending ones only withdraw.
 */
export function leaveCancellationPrompt(request: LeaveRequest): string {
  const range = formatRange(request);
  if (request.status === "approved") {
    return `Cancel your approved ${request.leaveType.name} on ${range}? The days will be returned to your balance.`;
  }
  return `Cancel your ${request.leaveType.name} on ${range}?`;
}
