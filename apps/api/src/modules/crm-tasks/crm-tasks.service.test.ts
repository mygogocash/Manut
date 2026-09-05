import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { crmTaskRepository } from "@/modules/crm-tasks/crm-tasks.repository";
import { CrmTaskService } from "@/modules/crm-tasks/crm-tasks.service";

vi.mock("@/modules/crm-tasks/crm-tasks.repository", () => ({
  crmTaskRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Assignment paths look the target/actor up and email the new owner.
const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), findUnique: vi.fn() },
}));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));
vi.mock("@/infrastructure/email/email.service", () => ({ sendEmail }));

const findMany = crmTaskRepository.findMany as Mock;
const findById = crmTaskRepository.findById as Mock;
const create = crmTaskRepository.create as Mock;
const update = crmTaskRepository.update as Mock;
const remove = crmTaskRepository.delete as Mock;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

const baseTask = {
  id: "task-1",
  subject: "Call back Tuesday",
  status: "open",
  dueDate: new Date("2026-05-10T00:00:00Z"),
  ownerId: USER_ID,
  leadId: "lead-1",
  opportunityId: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("CrmTaskService", () => {
  let service: CrmTaskService;

  beforeEach(() => {
    service = new CrmTaskService();
    vi.clearAllMocks();
    // Pin "now" to a known weekday inside May 2026 so bucket math is
    // deterministic across machines.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-06T12:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("list — bucket → date range", () => {
    it("overdue bucket asks for dueDate strictly before today", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });

      await service.list(USER_ID, ["crm:read", "crm:team-read"], {
        page: 1,
        limit: 20,
        bucket: "overdue",
      });

      const args = findMany.mock.calls[0][0] as {
        dueDateLte?: Date;
        dueDateGte?: Date;
      };
      expect(args.dueDateGte).toBeUndefined();
      expect(args.dueDateLte).toBeInstanceOf(Date);
      expect(args.dueDateLte!.getUTCFullYear()).toBe(2026);
      expect(args.dueDateLte!.getUTCMonth()).toBe(4); // May (0-indexed)
      expect(args.dueDateLte!.getUTCDate()).toBe(5); // Day before "today"
    });

    it("today bucket clamps to a single calendar day", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });

      await service.list(USER_ID, ["crm:read", "crm:team-read"], {
        page: 1,
        limit: 20,
        bucket: "today",
      });

      const args = findMany.mock.calls[0][0] as {
        dueDateGte?: Date;
        dueDateLte?: Date;
      };
      expect(args.dueDateGte!.toISOString()).toBe("2026-05-06T00:00:00.000Z");
      expect(args.dueDateLte!.toISOString()).toBe("2026-05-06T00:00:00.000Z");
    });

    it("soon bucket spans tomorrow + 7 days", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });

      await service.list(USER_ID, ["crm:read", "crm:team-read"], {
        page: 1,
        limit: 20,
        bucket: "soon",
      });

      const args = findMany.mock.calls[0][0] as {
        dueDateGte?: Date;
        dueDateLte?: Date;
      };
      expect(args.dueDateGte!.toISOString()).toBe("2026-05-07T00:00:00.000Z");
      expect(args.dueDateLte!.toISOString()).toBe("2026-05-13T00:00:00.000Z");
    });

    it("scopes to caller without crm:team-read", async () => {
      findMany.mockResolvedValue({ data: [], total: 0 });
      await service.list(USER_ID, ["crm:read"], { page: 1, limit: 20 });
      const args = findMany.mock.calls[0][0] as { ownerScope?: string[] };
      expect(args.ownerScope).toEqual([USER_ID]);
    });
  });

  describe("create", () => {
    it("connects at least one anchor", async () => {
      create.mockResolvedValue(baseTask);

      await service.create(USER_ID, {
        subject: "Call back",
        dueDate: "2026-05-10",
        leadId: "lead-1",
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          lead: { connect: { id: "lead-1" } },
          owner: { connect: { id: USER_ID } },
        }),
      );
    });

    it("assigns to another active user and emails them", async () => {
      create.mockResolvedValue(baseTask);
      db.user.findFirst.mockResolvedValue({
        id: OTHER_USER_ID,
        name: "Sid",
        email: "sid@x.com",
      });
      db.user.findUnique.mockResolvedValue({ name: "Kunanon" });

      await service.create(USER_ID, {
        subject: "Call back",
        dueDate: "2026-05-10",
        leadId: "lead-1",
        ownerId: OTHER_USER_ID,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: { connect: { id: OTHER_USER_ID } },
        }),
      );
      // Target validated as active + not deleted.
      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: OTHER_USER_ID,
            isActive: true,
            deletedAt: null,
          }),
        }),
      );
      await vi.waitFor(() => expect(sendEmail).toHaveBeenCalled());
      expect(sendEmail.mock.calls[0][0].to).toBe("sid@x.com");
    });

    it("rejects assignment to an inactive/unknown user", async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(USER_ID, {
          subject: "Call back",
          dueDate: "2026-05-10",
          leadId: "lead-1",
          ownerId: OTHER_USER_ID,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it("self-assignment behaves like no assignment (no lookup, no email)", async () => {
      create.mockResolvedValue(baseTask);

      await service.create(USER_ID, {
        subject: "Call back",
        dueDate: "2026-05-10",
        leadId: "lead-1",
        ownerId: USER_ID,
      });

      expect(db.user.findFirst).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("stamps completedAt when status flips to done", async () => {
      findById.mockResolvedValue(baseTask);
      update.mockResolvedValue(baseTask);

      await service.update("task-1", USER_ID, ["crm:update"], {
        status: "done",
      });

      const args = update.mock.calls[0][1] as Record<string, unknown>;
      expect(args.status).toBe("done");
      expect(args.completedAt).toBeInstanceOf(Date);
    });

    it("reassigns to another user and emails the new owner", async () => {
      findById.mockResolvedValue(baseTask);
      update.mockResolvedValue(baseTask);
      db.user.findFirst.mockResolvedValue({
        id: OTHER_USER_ID,
        name: "Sid",
        email: "sid@x.com",
      });
      db.user.findUnique.mockResolvedValue({ name: "Kunanon" });

      await service.update("task-1", USER_ID, ["crm:update"], {
        ownerId: OTHER_USER_ID,
      });

      expect(update).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          owner: { connect: { id: OTHER_USER_ID } },
        }),
      );
      await vi.waitFor(() => expect(sendEmail).toHaveBeenCalled());
      expect(sendEmail.mock.calls[0][0].to).toBe("sid@x.com");
    });

    it("re-arms the deadline-reminder ladder on a dueDate change", async () => {
      findById.mockResolvedValue(baseTask);
      update.mockResolvedValue(baseTask);

      await service.update("task-1", USER_ID, ["crm:update"], {
        dueDate: "2026-08-01",
      });

      expect(update).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          remindersSent: [],
          lastReminderSentAt: null,
        }),
      );
    });

    it("does NOT reset the reminder ladder when dueDate is untouched", async () => {
      findById.mockResolvedValue(baseTask);
      update.mockResolvedValue(baseTask);

      await service.update("task-1", USER_ID, ["crm:update"], {
        subject: "renamed",
      });

      const args = update.mock.calls[0][1] as Record<string, unknown>;
      expect(args.remindersSent).toBeUndefined();
    });

    it("clears completedAt when reopening from done", async () => {
      findById.mockResolvedValue({
        ...baseTask,
        status: "done",
        completedAt: new Date(),
      });
      update.mockResolvedValue(baseTask);

      await service.update("task-1", USER_ID, ["crm:update"], {
        status: "open",
      });

      expect(update).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({ status: "open", completedAt: null }),
      );
    });

    it("rejects edits on a cancelled task", async () => {
      findById.mockResolvedValue({ ...baseTask, status: "cancelled" });

      await expect(
        service.update("task-1", USER_ID, ["crm:update"], {
          subject: "x",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("complete", () => {
    it("is idempotent on already-done rows", async () => {
      const done = {
        ...baseTask,
        status: "done",
        completedAt: new Date("2026-05-01T10:00:00Z"),
      };
      findById.mockResolvedValue(done);

      const result = await service.complete("task-1", USER_ID, ["crm:update"]);

      expect(update).not.toHaveBeenCalled();
      expect(result).toBe(done);
    });

    it("rejects completing a cancelled task", async () => {
      findById.mockResolvedValue({ ...baseTask, status: "cancelled" });

      await expect(
        service.complete("task-1", USER_ID, ["crm:update"]),
      ).rejects.toThrow(BadRequestException);
    });

    it("flips status and stamps completedAt for an open task", async () => {
      findById.mockResolvedValue(baseTask);
      update.mockResolvedValue({ ...baseTask, status: "done" });

      await service.complete("task-1", USER_ID, ["crm:update"]);

      const args = update.mock.calls[0][1] as Record<string, unknown>;
      expect(args.status).toBe("done");
      expect(args.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("delete", () => {
    it("blocks delete when caller does not own the row", async () => {
      findById.mockResolvedValue({ ...baseTask, ownerId: OTHER_USER_ID });

      await expect(
        service.delete("task-1", USER_ID, ["crm:delete"]),
      ).rejects.toThrow(NotFoundException);
      expect(remove).not.toHaveBeenCalled();
    });
  });
});
