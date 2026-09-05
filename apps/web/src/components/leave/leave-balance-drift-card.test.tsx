import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveBalanceDriftCard } from "@/components/leave/leave-balance-drift-card";
import {
  type BalanceDriftRow,
  getBalanceDrift,
} from "@/services/leave.service";

vi.mock("@/services/leave.service", () => ({
  getBalanceDrift: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedGetDrift = vi.mocked(getBalanceDrift);

const baseRow: BalanceDriftRow = {
  balanceId: "bal-1",
  employee: { id: "u-1", name: "Darpan", email: "darpan@example.com" },
  leaveType: { id: "lt-1", name: "Annual Leave" },
  year: 2026,
  entitled: 14,
  used: 8,
  carriedUsed: 0,
  approvedDays: 4,
  approvedCarriedDays: 0,
  drift: 4,
  carriedDrift: 0,
  deletedApprovedDays: 0,
  undeductedApprovedDays: 0,
  ledgerRowCount: 0,
  ledgerDelta: 0,
};

describe("LeaveBalanceDriftCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a clean bill of health when nothing has drifted", async () => {
    mockedGetDrift.mockResolvedValue({
      data: [],
      meta: { year: null, scanned: 480, drifted: 0, untouchedByHr: 0 },
    });

    render(<LeaveBalanceDriftCard />);

    await waitFor(() =>
      expect(
        screen.getByText(/All 480 balances agree with their approved requests/),
      ).toBeInTheDocument(),
    );
  });

  it("shows the drifted balance with a signed delta", async () => {
    mockedGetDrift.mockResolvedValue({
      data: [baseRow],
      meta: { year: null, scanned: 480, drifted: 1, untouchedByHr: 1 },
    });

    render(<LeaveBalanceDriftCard />);

    await waitFor(() =>
      expect(screen.getByText("darpan@example.com")).toBeInTheDocument(),
    );
    // Sign matters: +4 means the card overcharges, -4 undercharges.
    expect(screen.getByText("+4")).toBeInTheDocument();
    expect(screen.getByText("Annual Leave")).toBeInTheDocument();
  });

  it("names deleted requests as the cause when days sit on deleted rows", async () => {
    mockedGetDrift.mockResolvedValue({
      data: [{ ...baseRow, deletedApprovedDays: 4 }],
      meta: { year: null, scanned: 480, drifted: 1, untouchedByHr: 1 },
    });

    render(<LeaveBalanceDriftCard />);

    await waitFor(() =>
      expect(screen.getByText("4d on deleted requests")).toBeInTheDocument(),
    );
  });

  it("flags an HR edit instead of a cause when one is on record", async () => {
    mockedGetDrift.mockResolvedValue({
      data: [{ ...baseRow, ledgerRowCount: 2, ledgerDelta: 4 }],
      meta: { year: null, scanned: 480, drifted: 1, untouchedByHr: 0 },
    });

    render(<LeaveBalanceDriftCard />);

    // A balance HR deliberately set is not a bug — the panel must not
    // invite someone to "correct" it back.
    await waitFor(() =>
      expect(screen.getByText("2 HR edits")).toBeInTheDocument(),
    );
  });

  it("calls out drift that no HR edit explains", async () => {
    mockedGetDrift.mockResolvedValue({
      data: [baseRow],
      meta: { year: null, scanned: 480, drifted: 1, untouchedByHr: 1 },
    });

    render(<LeaveBalanceDriftCard />);

    await waitFor(() =>
      expect(screen.getByText(/with no HR edit on record/)).toBeInTheDocument(),
    );
    expect(screen.getByText("No HR edit on record")).toBeInTheDocument();
  });
});
