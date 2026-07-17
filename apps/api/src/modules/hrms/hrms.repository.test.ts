import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { HrmsRepository } from "@/modules/hrms/hrms.repository";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    esopGrant: {
      findMany: vi.fn(),
    },
  },
}));

describe("HrmsRepository.getEsopPoolSummary", () => {
  let repository: HrmsRepository;

  beforeEach(() => {
    repository = new HrmsRepository();
    vi.clearAllMocks();
    (prisma.esopGrant.findMany as Mock).mockResolvedValue([]);
  });

  it("getEsopPoolSummary > given legacy and current statuses > then includes every non-cancelled status", async () => {
    await repository.getEsopPoolSummary();

    expect(prisma.esopGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ["active", "vesting", "vested", "exercised"] },
        },
      }),
    );
  });
});
