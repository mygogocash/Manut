import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { helpdeskRepository } from "@/modules/helpdesk/helpdesk.repository";
import { helpdeskService } from "@/modules/helpdesk/helpdesk.service";

// Only the methods update() touches need stubbing. createdBy.email is null
// on the returned row so the status-email branch is skipped — keeping this
// a pure test of the stamping logic (first-response + reopen accounting).
vi.mock("@/modules/helpdesk/helpdesk.repository", () => ({
  helpdeskRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

const STAFF = [PERMISSIONS.IT_READ_ALL, PERMISSIONS.IT_UPDATE];

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    ticketNumber: 1,
    title: "Printer down",
    description: "d",
    category: "hardware",
    priority: "high",
    status: "open",
    createdById: "creator",
    assigneeId: null,
    resolutionNote: null,
    resolvedAt: null,
    closedAt: null,
    firstResponseAt: null,
    reopenedCount: 0,
    attachments: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    createdBy: { id: "creator", name: "Creator", email: null },
    assignee: null,
    ...overrides,
  };
}

function lastUpdateData(): Record<string, unknown> {
  const calls = (helpdeskRepository.update as Mock).mock.calls;
  return calls[calls.length - 1][1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("helpdesk update — first-response stamp", () => {
  it("stamps firstResponseAt when an open ticket leaves open", async () => {
    (helpdeskRepository.findById as Mock).mockResolvedValue(
      makeTicket({ status: "open", assigneeId: null, firstResponseAt: null }),
    );
    (helpdeskRepository.update as Mock).mockResolvedValue(
      makeTicket({ status: "in-progress" }),
    );

    await helpdeskService.update(
      "t1",
      { status: "in-progress" },
      "it-staff",
      STAFF,
    );

    const data = lastUpdateData();
    expect(data.firstResponseAt).toBeInstanceOf(Date);
    expect(data.status).toBe("in-progress");
    expect(data).not.toHaveProperty("reopenedCount");
  });

  it("does not re-stamp firstResponseAt once it is already set", async () => {
    (helpdeskRepository.findById as Mock).mockResolvedValue(
      makeTicket({
        status: "in-progress",
        assigneeId: null,
        firstResponseAt: new Date("2026-05-01T01:00:00.000Z"),
      }),
    );
    (helpdeskRepository.update as Mock).mockResolvedValue(
      makeTicket({ status: "in-progress", assigneeId: "u2" }),
    );

    await helpdeskService.update("t1", { assigneeId: "u2" }, "it-staff", [
      ...STAFF,
      PERMISSIONS.IT_ASSIGN,
    ]);

    const data = lastUpdateData();
    expect(data).not.toHaveProperty("firstResponseAt");
    expect(data.assigneeId).toBe("u2");
  });
});

describe("helpdesk update — reopen accounting", () => {
  it("increments reopenedCount and clears resolution stamps on reopen", async () => {
    (helpdeskRepository.findById as Mock).mockResolvedValue(
      makeTicket({
        status: "resolved",
        assigneeId: "u2",
        firstResponseAt: new Date("2026-05-01T01:00:00.000Z"),
        resolvedAt: new Date("2026-05-02T00:00:00.000Z"),
      }),
    );
    (helpdeskRepository.update as Mock).mockResolvedValue(
      makeTicket({ status: "in-progress" }),
    );

    await helpdeskService.update(
      "t1",
      { status: "in-progress" },
      "it-staff",
      STAFF,
    );

    const data = lastUpdateData();
    expect(data.reopenedCount).toEqual({ increment: 1 });
    expect(data.resolvedAt).toBeNull();
    expect(data.closedAt).toBeNull();
    // Already responded earlier — reopening must not move firstResponseAt.
    expect(data).not.toHaveProperty("firstResponseAt");
  });

  it("does not touch reopenedCount on a normal forward transition", async () => {
    (helpdeskRepository.findById as Mock).mockResolvedValue(
      makeTicket({
        status: "in-progress",
        assigneeId: "u2",
        firstResponseAt: new Date("2026-05-01T01:00:00.000Z"),
      }),
    );
    (helpdeskRepository.update as Mock).mockResolvedValue(
      makeTicket({ status: "review" }),
    );

    await helpdeskService.update("t1", { status: "review" }, "it-staff", STAFF);

    const data = lastUpdateData();
    expect(data).not.toHaveProperty("reopenedCount");
  });
});
