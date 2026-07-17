import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { DirectoryRepository } from "@/modules/directory/directory.repository";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

describe("DirectoryRepository soft-delete boundary", () => {
  let repository: DirectoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findMany as Mock).mockResolvedValue([]);
    (prisma.user.count as Mock).mockResolvedValue(0);
    (prisma.user.findFirst as Mock).mockResolvedValue(null);
    (prisma.user.groupBy as Mock).mockResolvedValue([]);
    repository = new DirectoryRepository();
  });

  it("excludes deleted active users from the directory list and count", async () => {
    await repository.findAllEmployees({}, 1, 24);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, deletedAt: null },
      }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null },
    });
  });

  it("excludes deleted users from assignable lists and lookups", async () => {
    await repository.findAssignable({}, 1, 20);
    await repository.findAssignableById("11111111-1111-4111-8111-111111111111");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, deletedAt: null },
      }),
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "11111111-1111-4111-8111-111111111111",
          isActive: true,
          deletedAt: null,
        },
      }),
    );
  });

  it("excludes deleted users from details, department counts, and org charts", async () => {
    await repository.findById("11111111-1111-4111-8111-111111111111");
    await repository.getDepartments();
    await repository.getOrgChart();

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "11111111-1111-4111-8111-111111111111",
          isActive: true,
          deletedAt: null,
        },
      }),
    );
    expect(prisma.user.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          deletedAt: null,
          department: { not: null },
        },
      }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, deletedAt: null },
      }),
    );
  });
});
