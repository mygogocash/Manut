import { beforeEach, describe, expect, it, vi } from "vitest";

import { notifyCrmTaskEvent } from "@/modules/crm-shared/crm-notifications";

const db = vi.hoisted(() => ({
  projectTask: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  crmNotification: { createMany: vi.fn() },
}));
const sendEmail = vi.hoisted(() => vi.fn());
const getCrmReminderRecipients = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));
vi.mock("@/infrastructure/email/email.service", () => ({ sendEmail }));
vi.mock("@/modules/crm-shared/crm-recipients", () => ({
  getCrmReminderRecipients,
}));

const base = {
  module: "it" as const,
  type: "task_status" as const,
  projectId: "p1",
  projectName: "Atlas",
  taskId: "t1",
  taskTitle: "Ship it",
  actorId: "actor",
  summary: "moved it to Done",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ name: "Alice", email: "actor@x.com" });
  db.crmNotification.createMany.mockResolvedValue({ count: 0 });
  getCrmReminderRecipients.mockResolvedValue({ recipients: [] });
});

describe("notifyCrmTaskEvent", () => {
  it("writes a bell row per recipient with the module discriminator, excluding the actor", async () => {
    db.projectTask.findUnique.mockResolvedValue({
      owner: { id: "owner", name: "Owner", email: "owner@x.com" },
      assignees: [
        { user: { id: "a1", name: "A1", email: "a1@x.com" } },
        { user: { id: "actor", name: "Actor", email: "actor@x.com" } },
      ],
    });
    await notifyCrmTaskEvent(base);
    const rows = db.crmNotification.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { userId: string }) => r.userId).sort()).toEqual([
      "a1",
      "owner",
    ]);
    expect(rows.every((r: { module: string }) => r.module === "it")).toBe(true);
  });

  it("carries the module list-slug into the deep link (?from=)", async () => {
    db.projectTask.findUnique.mockResolvedValue({
      owner: { id: "owner", name: "Owner", email: "owner@x.com" },
      assignees: [],
    });
    await notifyCrmTaskEvent({ ...base, module: "legal" });
    const link = db.crmNotification.createMany.mock.calls[0][0].data[0].linkUrl;
    expect(link).toContain("from=legal-crm");
  });

  it("never emails the actor, even when on the configured list", async () => {
    db.projectTask.findUnique.mockResolvedValue({
      owner: { id: "owner", name: "Owner", email: "owner@x.com" },
      assignees: [],
    });
    getCrmReminderRecipients.mockResolvedValue({
      recipients: ["actor@x.com", "lead@x.com"],
    });
    await notifyCrmTaskEvent(base);
    const to = sendEmail.mock.calls[0][0].to;
    expect(to).not.toContain("actor@x.com");
    expect([...to].sort()).toEqual(["lead@x.com", "owner@x.com"]);
  });

  it("no-ops (no throw) when the task is gone", async () => {
    db.projectTask.findUnique.mockResolvedValue(null);
    await expect(notifyCrmTaskEvent(base)).resolves.toBeUndefined();
    expect(db.crmNotification.createMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("native adapter: `people` skips the shared-table lookup and `link` overrides the deep link (qa)", async () => {
    await notifyCrmTaskEvent({
      ...base,
      module: "qa",
      people: {
        owner: { id: "owner", name: "Owner", email: "owner@x.com" },
        assignees: [
          { id: "a1", name: "A1", email: "a1@x.com" },
          { id: "actor", name: "Actor", email: "actor@x.com" },
        ],
      },
      link: "https://portal.example/qa-crm/p1",
    });
    // Shared project_tasks was never consulted.
    expect(db.projectTask.findUnique).not.toHaveBeenCalled();
    const rows = db.crmNotification.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { userId: string }) => r.userId).sort()).toEqual([
      "a1",
      "owner",
    ]);
    expect(rows.every((r: { module: string }) => r.module === "qa")).toBe(true);
    expect(
      rows.every(
        (r: { linkUrl: string }) =>
          r.linkUrl === "https://portal.example/qa-crm/p1",
      ),
    ).toBe(true);
  });
});
