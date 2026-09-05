import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { projectRepository } from "@/modules/projects/projects.repository";
import { ProjectService } from "@/modules/projects/projects.service";
import {
  createMilestoneSchema,
  createTaskSchema,
  updateTaskSchema,
} from "@/modules/projects/projects.validation";

vi.mock("@/modules/projects/projects.repository", () => ({
  projectRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    update: vi.fn(),
    mirrorNativeProjectIfNeeded: vi.fn(),
    findParticipantRole: vi.fn(),
    findTaskById: vi.fn(),
    findMilestoneById: vi.fn(),
    findDependencyById: vi.fn(),
    findResourceById: vi.fn(),
    findTaskWithOwner: vi.fn(),
    listProjectDependencyEdges: vi.fn(),
    listAssignees: vi.fn(),
    listDependencies: vi.fn(),
    listResources: vi.fn(),
    listMilestones: vi.fn(),
    listDependentsWithAssignees: vi.fn(),
    createTask: vi.fn(),
    createDependency: vi.fn(),
    createResource: vi.fn(),
    createMilestone: vi.fn(),
    createActivities: vi.fn(),
    deleteDependency: vi.fn(),
    deleteResource: vi.fn(),
    setAssignees: vi.fn(),
    updateTask: vi.fn(),
    updateTaskAndLog: vi.fn(),
    resolveItDefaultAssignee: vi.fn(),
    resolveProjectDefaultAssignee: vi.fn(),
    resolveLegalDefaultAssignee: vi.fn(),
    resolveAccountingDefaultAssignee: vi.fn(),
    syncNativeGoLiveDates: vi.fn(),
  },
}));

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  createSignedUrl: vi.fn(),
  parseStorageUrl: vi.fn(),
}));

// Analytics is best-effort and isn't part of this surface area.
vi.mock("@/lib/events", () => ({
  actorFromId: vi.fn().mockResolvedValue(null),
  trackProjectCreatedServer: vi.fn(),
  trackTaskCreatedServer: vi.fn(),
  trackTaskStatusChangedServer: vi.fn(),
}));

const findById = projectRepository.findById as Mock;
const findBySlug = projectRepository.findBySlug as Mock;
const mirrorNativeProjectIfNeeded =
  projectRepository.mirrorNativeProjectIfNeeded as Mock;
const findParticipantRole = projectRepository.findParticipantRole as Mock;
const updateProject = projectRepository.update as Mock;
const findTaskById = projectRepository.findTaskById as Mock;
const findMilestoneById = projectRepository.findMilestoneById as Mock;
const listProjectDependencyEdges =
  projectRepository.listProjectDependencyEdges as Mock;
const createTask = projectRepository.createTask as Mock;
const createDependency = projectRepository.createDependency as Mock;
const createActivities = projectRepository.createActivities as Mock;
const setAssignees = projectRepository.setAssignees as Mock;
const resolveItDefaultAssignee =
  projectRepository.resolveItDefaultAssignee as Mock;
const resolveProjectDefaultAssignee =
  projectRepository.resolveProjectDefaultAssignee as Mock;
const resolveLegalDefaultAssignee =
  projectRepository.resolveLegalDefaultAssignee as Mock;
const resolveAccountingDefaultAssignee =
  projectRepository.resolveAccountingDefaultAssignee as Mock;
const syncNativeGoLiveDates = projectRepository.syncNativeGoLiveDates as Mock;

const PROJECT_ID = "p-1";
const USER_ID = "u-1";
const MANAGE_PERMS = [PERMISSIONS.PROJECTS_MANAGE];

const baseProject = {
  id: PROJECT_ID,
  slug: "p-1",
  ownerId: USER_ID,
  name: "Test",
  members: [],
};

beforeEach(() => {
  // `resetAllMocks` clears both call history AND the queued
  // `mockResolvedValueOnce` implementations. Earlier we used
  // `clearAllMocks` and the unused Once-queue from one test leaked
  // into the next — `listProjectDependencyEdges.mockResolvedValueOnce([])`
  // staged in the self-dep test was never consumed (the self-check
  // throws first), so the cycle-detection test downstream popped that
  // empty array instead of its own setup.
  vi.resetAllMocks();
  findById.mockResolvedValue(baseProject);
  findBySlug.mockResolvedValue(null);
  findParticipantRole.mockResolvedValue("owner");
});

describe("createTaskSchema — date range refinement", () => {
  it("accepts when startDate <= endDate", () => {
    const res = createTaskSchema.safeParse({
      title: "T",
      startDate: "2026-05-10",
      endDate: "2026-05-15",
    });
    expect(res.success).toBe(true);
  });

  it("accepts when only one of start/end is supplied", () => {
    expect(
      createTaskSchema.safeParse({ title: "T", startDate: "2026-05-10" })
        .success,
    ).toBe(true);
    expect(
      createTaskSchema.safeParse({ title: "T", endDate: "2026-05-10" }).success,
    ).toBe(true);
  });

  it("rejects when endDate is before startDate", () => {
    const res = createTaskSchema.safeParse({
      title: "T",
      startDate: "2026-05-15",
      endDate: "2026-05-10",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path).toContain("endDate");
    }
  });
});

describe("createMilestoneSchema — date range refinement", () => {
  it("rejects when endDate is before startDate", () => {
    const res = createMilestoneSchema.safeParse({
      title: "M",
      startDate: "2026-06-15",
      endDate: "2026-06-10",
    });
    expect(res.success).toBe(false);
  });

  it("accepts equal dates (single-day milestone)", () => {
    const res = createMilestoneSchema.safeParse({
      title: "M",
      startDate: "2026-06-15",
      endDate: "2026-06-15",
    });
    expect(res.success).toBe(true);
  });
});

describe("ProjectService.getById — native legal/IT mirror heal", () => {
  it("mirrors a native workstream into projects on first open, then returns it", async () => {
    const service = new ProjectService();
    // Missing from the general projects table (by id and by slug)...
    findById.mockResolvedValueOnce(null);
    findBySlug.mockResolvedValueOnce(null);
    // ...the lazy heal creates the mirror...
    mirrorNativeProjectIfNeeded.mockResolvedValueOnce(true);
    // ...and the re-read now resolves it.
    findById.mockResolvedValueOnce({ ...baseProject, team: "legal" });
    findParticipantRole.mockResolvedValue("owner");

    const result = await service.getById(USER_ID, [], "legal-id");

    expect(mirrorNativeProjectIfNeeded).toHaveBeenCalledWith("legal-id");
    expect(result).toMatchObject({ id: PROJECT_ID, team: "legal" });
  });

  it("404s when the id is neither a general nor a native project", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue(null);
    findBySlug.mockResolvedValue(null);
    mirrorNativeProjectIfNeeded.mockResolvedValue(false);

    await expect(service.getById(USER_ID, [], "ghost")).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("ProjectService.addTask — N-level subtask nesting", () => {
  it("allows a subtask of a subtask (Phase 1 cap lifted)", async () => {
    const service = new ProjectService();
    findTaskById.mockResolvedValueOnce({
      id: "task-2",
      projectId: PROJECT_ID,
      parentTaskId: "task-1", // already nested once
    });
    createTask.mockResolvedValueOnce({
      id: "task-3",
      title: "deep",
      projectId: PROJECT_ID,
      parentTaskId: "task-2",
    });

    await expect(
      service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, {
        title: "deep",
        status: "todo",
        priority: "P1",
        sortOrder: 0,
        parentTaskId: "task-2",
      }),
    ).resolves.toMatchObject({ id: "task-3" });

    expect(createTask).toHaveBeenCalledOnce();
  });

  it("rejects when parent task belongs to a different project", async () => {
    const service = new ProjectService();
    findTaskById.mockResolvedValueOnce({
      id: "task-2",
      projectId: "other-project",
      parentTaskId: null,
    });

    await expect(
      service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, {
        title: "x",
        status: "todo",
        priority: "P1",
        sortOrder: 0,
        parentTaskId: "task-2",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("passes endDate straight through to the repo (legacy dueDate dual-write retired in Phase 4c)", async () => {
    const service = new ProjectService();
    createTask.mockResolvedValueOnce({
      id: "task-new",
      projectId: PROJECT_ID,
    });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      title: "x",
      status: "todo",
      priority: "P1",
      sortOrder: 0,
      endDate: "2026-05-20",
    });

    const passed = createTask.mock.calls[0][0];
    expect(passed.endDate).toEqual(new Date("2026-05-20"));
    expect(passed.dueDate).toBeUndefined();
  });

  it("seeds assignees from ownerId when no explicit assigneeIds given", async () => {
    const service = new ProjectService();
    createTask.mockResolvedValueOnce({
      id: "task-new",
      projectId: PROJECT_ID,
    });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      title: "x",
      status: "todo",
      priority: "P1",
      sortOrder: 0,
      ownerId: "u-99",
    });

    expect(setAssignees).toHaveBeenCalledWith("task-new", [{ userId: "u-99" }]);
  });
});

describe("ProjectService.addTask — IT CRM auto-assign default", () => {
  const IT_PROJECT = { ...baseProject, team: "it" };
  const taskInput = {
    title: "x",
    status: "todo",
    priority: "P1",
    sortOrder: 0,
  } as const;

  it("applies the project default when owner + assignees are left blank (IT CRM)", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue(IT_PROJECT);
    resolveItDefaultAssignee.mockResolvedValue("u-default");
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, { ...taskInput });

    expect(resolveItDefaultAssignee).toHaveBeenCalledWith(PROJECT_ID, USER_ID);
    expect(createTask.mock.calls[0][0].ownerId).toBe("u-default");
    expect(setAssignees).toHaveBeenCalledWith("task-new", [
      { userId: "u-default" },
    ]);
  });

  it("never overrides an explicit owner (IT CRM)", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue(IT_PROJECT);
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      ...taskInput,
      ownerId: "u-explicit",
    });

    expect(resolveItDefaultAssignee).not.toHaveBeenCalled();
    expect(createTask.mock.calls[0][0].ownerId).toBe("u-explicit");
  });

  it("does not apply the default on non-IT boards", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "general" });
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, { ...taskInput });

    expect(resolveItDefaultAssignee).not.toHaveBeenCalled();
    expect(createTask.mock.calls[0][0].ownerId).toBeUndefined();
  });

  it("leaves the task unassigned when the default resolves to null", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue(IT_PROJECT);
    resolveItDefaultAssignee.mockResolvedValue(null);
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, { ...taskInput });

    expect(createTask.mock.calls[0][0].ownerId).toBeUndefined();
    expect(setAssignees).not.toHaveBeenCalled();
  });
});

describe("ProjectService.addTask — shared-board auto-assign (general/hr)", () => {
  const taskInput = {
    title: "x",
    status: "todo",
    priority: "P1",
    sortOrder: 0,
  } as const;

  it("resolves the default from the shared projects row for team 'general'", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "general" });
    resolveProjectDefaultAssignee.mockResolvedValue("u-default");
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, { ...taskInput });

    expect(resolveProjectDefaultAssignee).toHaveBeenCalledWith(
      PROJECT_ID,
      USER_ID,
    );
    expect(resolveItDefaultAssignee).not.toHaveBeenCalled();
    expect(createTask.mock.calls[0][0].ownerId).toBe("u-default");
    expect(setAssignees).toHaveBeenCalledWith("task-new", [
      { userId: "u-default" },
    ]);
  });

  it("resolves via the shared row for team 'hr' too", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "hr" });
    resolveProjectDefaultAssignee.mockResolvedValue("u-hr");
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, { ...taskInput });

    expect(resolveProjectDefaultAssignee).toHaveBeenCalledWith(
      PROJECT_ID,
      USER_ID,
    );
    expect(createTask.mock.calls[0][0].ownerId).toBe("u-hr");
  });

  it("does not resolve for an explicit owner (general)", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "general" });
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      ...taskInput,
      ownerId: "u-explicit",
    });

    expect(resolveProjectDefaultAssignee).not.toHaveBeenCalled();
    expect(createTask.mock.calls[0][0].ownerId).toBe("u-explicit");
  });
});

describe("ProjectService.update — native go-live date sync (it/legal/accounting)", () => {
  beforeEach(() => {
    findParticipantRole.mockResolvedValue("owner");
    updateProject.mockResolvedValue({ id: PROJECT_ID });
  });

  it("propagates a go-live edit on a legal mirror row to the native table", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "legal" });

    await service.update(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      goLiveDate: "2026-09-01",
    });

    expect(syncNativeGoLiveDates).toHaveBeenCalledWith(
      "legal",
      PROJECT_ID,
      expect.objectContaining({ goLiveDate: new Date("2026-09-01") }),
    );
  });

  it("propagates a revised-go-live clear (null) for an IT mirror row", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "it" });

    await service.update(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      revisedGoLiveDate: null,
    });

    expect(syncNativeGoLiveDates).toHaveBeenCalledWith("it", PROJECT_ID, {
      revisedGoLiveDate: null,
    });
  });

  it("propagates a production-live edit for accounting without touching go-live", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "accounting" });

    await service.update(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      productionLiveDate: "2026-10-01",
    });

    expect(syncNativeGoLiveDates).toHaveBeenCalledWith(
      "accounting",
      PROJECT_ID,
      { productionLiveDate: new Date("2026-10-01") },
    );
  });

  it("does not call the sync when no date field is edited", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "legal" });

    await service.update(USER_ID, MANAGE_PERMS, PROJECT_ID, { progress: 40 });

    expect(syncNativeGoLiveDates).not.toHaveBeenCalled();
  });
});

describe("ProjectService.addTask — native-mirror auto-assign (legal/accounting)", () => {
  const taskInput = {
    title: "x",
    status: "todo",
    priority: "P1",
    sortOrder: 0,
  } as const;

  it("resolves the default from the native legal_projects row for team 'legal'", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "legal" });
    resolveLegalDefaultAssignee.mockResolvedValue("u-legal");
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, { ...taskInput });

    expect(resolveLegalDefaultAssignee).toHaveBeenCalledWith(
      PROJECT_ID,
      USER_ID,
    );
    // Never falls through to the shared-projects resolver — the shared mirror
    // row never carries the config.
    expect(resolveProjectDefaultAssignee).not.toHaveBeenCalled();
    expect(createTask.mock.calls[0][0].ownerId).toBe("u-legal");
    expect(setAssignees).toHaveBeenCalledWith("task-new", [
      { userId: "u-legal" },
    ]);
  });

  it("resolves from the native accounting_projects row for team 'accounting'", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "accounting" });
    resolveAccountingDefaultAssignee.mockResolvedValue("u-acct");
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, { ...taskInput });

    expect(resolveAccountingDefaultAssignee).toHaveBeenCalledWith(
      PROJECT_ID,
      USER_ID,
    );
    expect(resolveProjectDefaultAssignee).not.toHaveBeenCalled();
    expect(createTask.mock.calls[0][0].ownerId).toBe("u-acct");
  });

  it("never overrides an explicit owner (legal)", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "legal" });
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      ...taskInput,
      ownerId: "u-explicit",
    });

    expect(resolveLegalDefaultAssignee).not.toHaveBeenCalled();
    expect(createTask.mock.calls[0][0].ownerId).toBe("u-explicit");
  });

  it("leaves the task unassigned when the native default resolves to null (accounting)", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "accounting" });
    resolveAccountingDefaultAssignee.mockResolvedValue(null);
    createTask.mockResolvedValueOnce({ id: "task-new", projectId: PROJECT_ID });

    await service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, { ...taskInput });

    expect(createTask.mock.calls[0][0].ownerId).toBeUndefined();
    expect(setAssignees).not.toHaveBeenCalled();
  });
});

describe("ProjectService.update — go-live edit re-arms reminder ladder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findParticipantRole.mockResolvedValue("owner");
    updateProject.mockResolvedValue({ id: PROJECT_ID });
  });

  it("clears remindersSent + lastReminderSentAt when revisedGoLiveDate changes", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "general" });

    await service.update(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      revisedGoLiveDate: "2026-09-01T00:00:00.000Z",
    });

    const payload = updateProject.mock.calls[0][1];
    expect(payload.remindersSent).toEqual([]);
    expect(payload.lastReminderSentAt).toBeNull();
  });

  it("clears the ladder on a goLiveDate change too", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "hr" });

    await service.update(USER_ID, MANAGE_PERMS, PROJECT_ID, {
      goLiveDate: "2026-10-15T00:00:00.000Z",
    });

    const payload = updateProject.mock.calls[0][1];
    expect(payload.remindersSent).toEqual([]);
    expect(payload.lastReminderSentAt).toBeNull();
  });

  it("leaves the ladder untouched when no go-live field is edited", async () => {
    const service = new ProjectService();
    findById.mockResolvedValue({ ...baseProject, team: "general" });

    await service.update(USER_ID, MANAGE_PERMS, PROJECT_ID, { progress: 50 });

    const payload = updateProject.mock.calls[0][1];
    expect(payload.remindersSent).toBeUndefined();
    expect(payload.lastReminderSentAt).toBeUndefined();
  });
});

describe("ProjectService.addTaskDependency — cycle detection", () => {
  const taskA = { id: "A", projectId: PROJECT_ID, parentTaskId: null };
  const taskB = { id: "B", projectId: PROJECT_ID, parentTaskId: null };
  const taskC = { id: "C", projectId: PROJECT_ID, parentTaskId: null };

  it("rejects when task tries to depend on itself", async () => {
    const service = new ProjectService();
    findTaskById
      .mockResolvedValueOnce(taskA) // taskId
      .mockResolvedValueOnce(taskA); // predecessor
    listProjectDependencyEdges.mockResolvedValueOnce([]);

    await expect(
      service.addTaskDependency(USER_ID, MANAGE_PERMS, PROJECT_ID, "A", {
        dependsOnTaskId: "A",
        type: "finish_to_start",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when adding a direct back-edge (A→B already exists, add B→A)", async () => {
    const service = new ProjectService();
    findTaskById
      .mockResolvedValueOnce(taskB) // taskId = B
      .mockResolvedValueOnce(taskA); // predecessor = A
    // Existing edge: A depends on B.
    listProjectDependencyEdges.mockResolvedValueOnce([
      { taskId: "A", dependsOnTaskId: "B" },
    ]);

    await expect(
      service.addTaskDependency(USER_ID, MANAGE_PERMS, PROJECT_ID, "B", {
        dependsOnTaskId: "A",
        type: "finish_to_start",
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/cycle/i),
    });
  });

  it("rejects when transitive cycle would form (A→B→C, add C→A)", async () => {
    const service = new ProjectService();
    findTaskById
      .mockResolvedValueOnce(taskC) // taskId = C
      .mockResolvedValueOnce(taskA); // predecessor = A
    // Existing: A blocked by B, B blocked by C  →  A → B → C
    // Adding C → A would close the loop.
    listProjectDependencyEdges.mockResolvedValueOnce([
      { taskId: "A", dependsOnTaskId: "B" },
      { taskId: "B", dependsOnTaskId: "C" },
    ]);

    await expect(
      service.addTaskDependency(USER_ID, MANAGE_PERMS, PROJECT_ID, "C", {
        dependsOnTaskId: "A",
        type: "finish_to_start",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows a non-cyclic edge and logs activity", async () => {
    const service = new ProjectService();
    findTaskById
      .mockResolvedValueOnce(taskA) // taskId = A
      .mockResolvedValueOnce(taskB); // predecessor = B
    listProjectDependencyEdges.mockResolvedValueOnce([]);
    createDependency.mockResolvedValueOnce({
      id: "dep-1",
      taskId: "A",
      dependsOnTaskId: "B",
    });

    const result = await service.addTaskDependency(
      USER_ID,
      MANAGE_PERMS,
      PROJECT_ID,
      "A",
      { dependsOnTaskId: "B", type: "finish_to_start" },
    );

    expect(result).toMatchObject({ id: "dep-1" });
    expect(createActivities).toHaveBeenCalledOnce();
    expect(createActivities.mock.calls[0][0][0]).toMatchObject({
      kind: "dependency_added",
      field: "dependency",
    });
  });
});

describe("ProjectService.addMilestone — validates project ownership", () => {
  it("rejects when caller lacks owner role and projects:manage perm", async () => {
    const service = new ProjectService();
    // `mockResolvedValue` (not Once) so BOTH findParticipantRole calls
    // resolve to "member": one inside `getById → requireParticipant`,
    // one inside `addMilestone → requireOwnerOrManage`.
    findParticipantRole.mockResolvedValue("member");

    await expect(
      service.addMilestone(USER_ID, [PERMISSIONS.PROJECTS_UPDATE], PROJECT_ID, {
        title: "M1",
        status: "not_started",
        sortOrder: 0,
      }),
    ).rejects.toThrow();
  });
});

describe("ProjectService.addTask — milestone scope check", () => {
  it("rejects when milestone belongs to a different project", async () => {
    const service = new ProjectService();
    findMilestoneById.mockResolvedValueOnce({
      id: "ms-1",
      projectId: "other-project",
    });

    await expect(
      service.addTask(USER_ID, MANAGE_PERMS, PROJECT_ID, {
        title: "x",
        status: "todo",
        priority: "P1",
        sortOrder: 0,
        milestoneId: "ms-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ProjectService.getResourceDownloadUrl — Phase 4b", () => {
  it("returns the stored URL unchanged for link/doc kinds", async () => {
    const service = new ProjectService();
    const findResourceById = projectRepository.findResourceById as Mock;
    findTaskById.mockResolvedValueOnce({
      id: "task-1",
      projectId: PROJECT_ID,
    });
    findResourceById.mockResolvedValueOnce({
      id: "res-1",
      taskId: "task-1",
      kind: "link",
      url: "https://example.com/doc",
    });

    const out = await service.getResourceDownloadUrl(
      USER_ID,
      MANAGE_PERMS,
      PROJECT_ID,
      "task-1",
      "res-1",
    );
    expect(out).toEqual({ url: "https://example.com/doc" });
  });

  it("mints a signed URL for file kind via Supabase helpers", async () => {
    const service = new ProjectService();
    const findResourceById = projectRepository.findResourceById as Mock;
    const { parseStorageUrl, createSignedUrl } =
      await import("@/infrastructure/storage/supabase-storage");
    (parseStorageUrl as Mock).mockReturnValueOnce({
      bucket: "documents",
      path: "u-1/abc.pdf",
    });
    (createSignedUrl as Mock).mockResolvedValueOnce(
      "https://supabase/sign/u-1/abc.pdf?token=xyz",
    );

    findTaskById.mockResolvedValueOnce({
      id: "task-1",
      projectId: PROJECT_ID,
    });
    findResourceById.mockResolvedValueOnce({
      id: "res-1",
      taskId: "task-1",
      kind: "file",
      url: "https://supabase/storage/v1/object/public/documents/u-1/abc.pdf",
    });

    const out = await service.getResourceDownloadUrl(
      USER_ID,
      MANAGE_PERMS,
      PROJECT_ID,
      "task-1",
      "res-1",
    );
    expect(parseStorageUrl).toHaveBeenCalled();
    expect(createSignedUrl).toHaveBeenCalledWith("documents", "u-1/abc.pdf");
    expect(out.url).toContain("token=xyz");
  });

  it("falls back to the stored URL when parseStorageUrl returns null (manual import row)", async () => {
    const service = new ProjectService();
    const findResourceById = projectRepository.findResourceById as Mock;
    const { parseStorageUrl, createSignedUrl } =
      await import("@/infrastructure/storage/supabase-storage");
    (parseStorageUrl as Mock).mockReturnValueOnce(null);

    findTaskById.mockResolvedValueOnce({
      id: "task-1",
      projectId: PROJECT_ID,
    });
    findResourceById.mockResolvedValueOnce({
      id: "res-1",
      taskId: "task-1",
      kind: "file",
      url: "s3://legacy/path.pdf",
    });

    const out = await service.getResourceDownloadUrl(
      USER_ID,
      MANAGE_PERMS,
      PROJECT_ID,
      "task-1",
      "res-1",
    );
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(out).toEqual({ url: "s3://legacy/path.pdf" });
  });
});

describe("ProjectService.updateTask — Phase 4 unblock notification", () => {
  it("emails dependents' assignees when status flips to done", async () => {
    // Pull the mocked email module dynamically — vi.mock already
    // replaced it at module-load time.
    const { sendEmail } = await import("@/infrastructure/email/email.service");
    const sendEmailMock = sendEmail as Mock;
    sendEmailMock.mockClear();

    const findTaskWithOwner = projectRepository.findTaskWithOwner as Mock;
    const listDeps = projectRepository.listDependentsWithAssignees as Mock;
    const updateTaskAndLog = projectRepository.updateTaskAndLog as Mock;

    findTaskWithOwner.mockResolvedValueOnce({
      id: "task-A",
      projectId: PROJECT_ID,
      title: "Build API",
      description: null,
      status: "in_progress",
      priority: "P1",
      ownerId: null,
      startDate: null,
      endDate: null,
      milestoneId: null,
      sortOrder: 0,
    });
    updateTaskAndLog.mockResolvedValueOnce({
      id: "task-A",
      status: "done",
    });
    // Dependent B is blocked by A; once A is done, B's two assignees
    // should be emailed.
    listDeps.mockResolvedValueOnce([
      {
        id: "dep-1",
        taskId: "task-B",
        task: {
          id: "task-B",
          title: "Wire UI to API",
          status: "todo",
          project: { id: PROJECT_ID, name: "Demo Project" },
          owner: { id: "u-owner", name: "Owner", email: "owner@example.com" },
          assignees: [
            { user: { id: "u-1", name: "Alice", email: "alice@example.com" } },
            { user: { id: "u-2", name: "Bob", email: "bob@example.com" } },
          ],
        },
      },
    ]);

    const service = new ProjectService();
    await service.updateTask(USER_ID, MANAGE_PERMS, PROJECT_ID, "task-A", {
      status: "done",
    });

    // Best-effort fire-and-forget — wait a tick so the unawaited
    // `notifyUnblocked` promise resolves before assertion.
    await new Promise((r) => setTimeout(r, 0));

    expect(listDeps).toHaveBeenCalledWith("task-A");
    expect(sendEmailMock).toHaveBeenCalledOnce();
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.subject).toMatch(/Unblocked.*Wire UI to API.*Demo Project/i);
    expect(call.to).toEqual(
      expect.arrayContaining([
        "alice@example.com",
        "bob@example.com",
        "owner@example.com",
      ]),
    );
    expect(call.html).toContain("Build API");
  });

  it("does not email when status changes but not to done", async () => {
    const { sendEmail } = await import("@/infrastructure/email/email.service");
    const sendEmailMock = sendEmail as Mock;
    sendEmailMock.mockClear();

    const findTaskWithOwner = projectRepository.findTaskWithOwner as Mock;
    const listDeps = projectRepository.listDependentsWithAssignees as Mock;
    const updateTaskAndLog = projectRepository.updateTaskAndLog as Mock;

    findTaskWithOwner.mockResolvedValueOnce({
      id: "task-A",
      projectId: PROJECT_ID,
      title: "Build API",
      description: null,
      status: "todo",
      priority: "P1",
      ownerId: null,
      startDate: null,
      endDate: null,
      milestoneId: null,
      sortOrder: 0,
    });
    updateTaskAndLog.mockResolvedValueOnce({
      id: "task-A",
      status: "in_progress",
    });

    const service = new ProjectService();
    await service.updateTask(USER_ID, MANAGE_PERMS, PROJECT_ID, "task-A", {
      status: "in_progress",
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(listDeps).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("updateTaskSchema — nullable dates (clearable)", () => {
  it("accepts null to clear a date", () => {
    const res = updateTaskSchema.safeParse({ endDate: null, startDate: null });
    expect(res.success).toBe(true);
  });

  it("date-range refine ignores a null end date", () => {
    // A start date with a cleared (null) end date must not trip the
    // "end before start" guard.
    const res = updateTaskSchema.safeParse({
      startDate: "2026-05-15",
      endDate: null,
    });
    expect(res.success).toBe(true);
  });
});

describe("ProjectService.updateTask — clearing a date", () => {
  it("writes endDate: null when the client sends null", async () => {
    const findTaskWithOwner = projectRepository.findTaskWithOwner as Mock;
    const updateTaskAndLog = projectRepository.updateTaskAndLog as Mock;

    findTaskWithOwner.mockResolvedValueOnce({
      id: "task-A",
      projectId: PROJECT_ID,
      title: "Build API",
      description: null,
      status: "todo",
      priority: "P1",
      ownerId: null,
      startDate: null,
      endDate: new Date("2026-06-09T00:00:00.000Z"),
      milestoneId: null,
      sortOrder: 0,
    });
    updateTaskAndLog.mockResolvedValueOnce({ id: "task-A", endDate: null });

    const service = new ProjectService();
    await service.updateTask(USER_ID, MANAGE_PERMS, PROJECT_ID, "task-A", {
      endDate: null,
    });

    // Clearing logs an activity, so the write goes through updateTaskAndLog.
    expect(updateTaskAndLog).toHaveBeenCalledTimes(1);
    const [, data] = updateTaskAndLog.mock.calls[0];
    expect(data.endDate).toBeNull();
  });

  it("leaves endDate unchanged when the field is omitted", async () => {
    const findTaskWithOwner = projectRepository.findTaskWithOwner as Mock;
    const updateTaskAndLog = projectRepository.updateTaskAndLog as Mock;
    const updateTask = projectRepository.updateTask as Mock;

    findTaskWithOwner.mockResolvedValueOnce({
      id: "task-A",
      projectId: PROJECT_ID,
      title: "Build API",
      description: null,
      status: "todo",
      priority: "P1",
      ownerId: null,
      startDate: null,
      endDate: new Date("2026-06-09T00:00:00.000Z"),
      milestoneId: null,
      sortOrder: 0,
    });
    updateTask.mockResolvedValueOnce({ id: "task-A" });

    const service = new ProjectService();
    await service.updateTask(USER_ID, MANAGE_PERMS, PROJECT_ID, "task-A", {
      priority: "P1", // unchanged → no date write
    });

    const dateWrites = [
      ...updateTaskAndLog.mock.calls,
      ...updateTask.mock.calls,
    ].some(([, data]) => data && "endDate" in data);
    expect(dateWrites).toBe(false);
  });
});
