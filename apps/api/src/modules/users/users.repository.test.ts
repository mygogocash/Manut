import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { usersRepository } from "@/modules/users/users.repository";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

describe("UsersRepository.findById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only non-deleted users while lifecycle finders remain explicit", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    await usersRepository.findById("user-123");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "user-123", deletedAt: null },
      include: {
        entity: { select: { id: true, name: true } },
        userRoles: {
          include: {
            role: {
              select: { id: true, name: true, description: true },
            },
          },
        },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
  });
});
