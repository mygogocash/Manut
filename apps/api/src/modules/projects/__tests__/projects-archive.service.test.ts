import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { ForbiddenException } from "@/common/exceptions/http-exception";
import { projectRepository } from "@/modules/projects/projects.repository";
import { ProjectService } from "@/modules/projects/projects.service";

vi.mock("@/modules/projects/projects.repository", () => ({
  projectRepository: {
    findRowById: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findParticipantRole: vi.fn(),
    update: vi.fn((_id, data) => ({ id: "p1", ...data })),
  },
}));

const repo = projectRepository as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;
const svc = new ProjectService();

describe("ProjectService archive / unarchive", () => {
  beforeEach(() => {
    repo.findRowById.mockReset();
    repo.findById.mockReset();
    repo.findBySlug.mockReset();
    repo.findParticipantRole.mockReset();
    repo.update.mockClear();
  });

  it("archives for the owner (sets archivedAt)", async () => {
    repo.findById.mockResolvedValue({
      id: "p1",
      team: "general",
      ownerId: "u1",
      archivedAt: null,
    });
    repo.findParticipantRole.mockResolvedValue("owner");
    await svc.archive("u1", [], "p1");
    const data = repo.update.mock.calls[0][1];
    expect(data.archivedAt).toBeInstanceOf(Date);
  });

  it("is idempotent — a re-archive keeps the original timestamp", async () => {
    const original = new Date("2026-01-01T00:00:00Z");
    repo.findById.mockResolvedValue({
      id: "p1",
      team: "general",
      ownerId: "u1",
      archivedAt: original,
    });
    repo.findParticipantRole.mockResolvedValue("owner");
    await svc.archive("u1", [], "p1");
    expect(repo.update.mock.calls[0][1].archivedAt).toBe(original);
  });

  it("unarchives (clears archivedAt) for a manage holder", async () => {
    repo.findById.mockResolvedValue({
      id: "p1",
      team: "general",
      ownerId: "someone-else",
      archivedAt: new Date(),
    });
    repo.findParticipantRole.mockResolvedValue(null);
    await svc.unarchive("mgr", [PERMISSIONS.PROJECTS_MANAGE], "p1");
    expect(repo.update.mock.calls[0][1].archivedAt).toBeNull();
  });

  it("blocks a non-owner without manage", async () => {
    repo.findById.mockResolvedValue({
      id: "p1",
      team: "general",
      ownerId: "someone-else",
      archivedAt: null,
    });
    repo.findParticipantRole.mockResolvedValue(null);
    await expect(svc.archive("stranger", [], "p1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });
});
