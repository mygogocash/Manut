import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  getAllColumns,
  getBaseColumns,
  getMyColumns,
} from "@/components/leave/leave-utils";
import type { LeaveRequest } from "@/services/leave.service";

function request(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: "lr_1",
    employee: { id: "u_1", name: "Kunanon Jarat", avatarUrl: null },
    leaveType: {
      id: "lt_1",
      name: "Annual Leave",
      code: "AL",
      category: "earned",
    },
    // Filed well before the leave itself — the fixture exists so a column that
    // accidentally renders `startDate` can't pass as the submitted date.
    createdAt: "2026-08-04T09:30:00.000Z",
    startDate: "2026-08-20T00:00:00.000Z",
    endDate: "2026-08-21T00:00:00.000Z",
    days: "2",
    reason: null,
    status: "pending",
    approver: null,
    approvedAt: null,
    rejectReason: null,
    ...overrides,
  };
}

describe("leave columns — Submitted", () => {
  it("sits between Days and Status in the base columns", () => {
    const keys = getBaseColumns().map((c) => c.key);
    expect(keys).toEqual([
      "leaveType",
      "dates",
      "days",
      "submittedAt",
      "status",
    ]);
  });

  it("is inherited by both the My requests and All Requests tabs", () => {
    const my = getMyColumns(() => {}).map((c) => c.key);
    const all = getAllColumns(
      true,
      () => {},
      () => {},
    ).map((c) => c.key);

    expect(my).toContain("submittedAt");
    expect(all).toContain("submittedAt");
    // Employee stays first on the admin table; Submitted keeps its slot.
    expect(all.indexOf("submittedAt")).toBeGreaterThan(all.indexOf("days"));
    expect(all.indexOf("submittedAt")).toBeLessThan(all.indexOf("status"));
  });

  it("renders createdAt, not the leave start date", () => {
    const r = request();
    const column = getBaseColumns().find((c) => c.key === "submittedAt");
    expect(column).toBeDefined();

    render(<>{column?.render?.(r)}</>);

    const cell = screen.getByText(formatDate(r.createdAt));
    expect(cell).toBeTruthy();
    expect(cell.textContent).not.toBe(formatDate(r.startDate));
    // Full timestamp lives in the tooltip so same-day filings stay separable.
    expect(cell.getAttribute("title")).toBe(formatDateTime(r.createdAt));
  });
});

describe("formatDateTime", () => {
  it("keeps the day/month/year of formatDate and appends a time", () => {
    const iso = "2026-08-04T09:30:00.000Z";
    expect(formatDateTime(iso).startsWith(formatDate(iso))).toBe(true);
    expect(formatDateTime(iso).length).toBeGreaterThan(formatDate(iso).length);
  });
});
