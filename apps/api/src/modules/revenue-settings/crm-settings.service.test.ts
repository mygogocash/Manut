import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { CrmSettingsService } from "@/modules/revenue-settings/crm-settings.service";

vi.mock("../../infrastructure/database/prisma", () => ({
  prisma: {
    revenueSettings: {
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe("CrmSettingsService", () => {
  let service: CrmSettingsService;

  beforeEach(() => {
    service = new CrmSettingsService();
    vi.clearAllMocks();
  });

  describe("getSettings", () => {
    it("returns the existing singleton row with serialized updatedAt", async () => {
      const updatedAt = new Date("2026-05-21T10:00:00Z");
      (prisma.revenueSettings.findFirst as Mock).mockResolvedValue({
        id: "row-1",
        singleton: true,
        notifyEmails: ["bd@manut.example"],
        notifyOnCreate: true,
        notifyOwnerOnCreate: false,
        notifyOwnerOnStageChange: true,
        updatedAt,
      });

      const result = await service.getSettings();

      expect(result).toEqual({
        data: {
          notifyEmails: ["bd@manut.example"],
          notifyOnCreate: true,
          notifyOwnerOnCreate: false,
          notifyOwnerOnStageChange: true,
          updatedAt: updatedAt.toISOString(),
        },
      });
      expect(prisma.revenueSettings.create).not.toHaveBeenCalled();
    });

    it("bootstraps the singleton row when missing (fresh DB)", async () => {
      (prisma.revenueSettings.findFirst as Mock).mockResolvedValue(null);
      const updatedAt = new Date("2026-05-21T10:00:00Z");
      (prisma.revenueSettings.create as Mock).mockResolvedValue({
        id: "row-1",
        singleton: true,
        notifyEmails: [],
        notifyOnCreate: true,
        notifyOwnerOnCreate: true,
        notifyOwnerOnStageChange: true,
        updatedAt,
      });

      const result = await service.getSettings();

      expect(prisma.revenueSettings.create).toHaveBeenCalledWith({
        data: { singleton: true, notifyEmails: [] },
      });
      expect(result.data.notifyEmails).toEqual([]);
    });
  });

  describe("updateSettings", () => {
    it("dedupes the email list and persists toggles with the actor id", async () => {
      const updatedAt = new Date("2026-05-21T11:00:00Z");
      (prisma.revenueSettings.upsert as Mock).mockResolvedValue({
        id: "row-1",
        singleton: true,
        notifyEmails: ["a@example.com", "b@example.com"],
        notifyOnCreate: false,
        notifyOwnerOnCreate: true,
        notifyOwnerOnStageChange: true,
        updatedAt,
      });

      const result = await service.updateSettings(
        {
          notifyEmails: [
            "a@example.com",
            "b@example.com",
            "a@example.com", // duplicate stripped
          ],
          notifyOnCreate: false,
          notifyOwnerOnCreate: true,
          notifyOwnerOnStageChange: true,
        },
        "actor-123",
      );

      expect(prisma.revenueSettings.upsert).toHaveBeenCalledWith({
        where: { singleton: true },
        create: expect.objectContaining({
          singleton: true,
          notifyEmails: ["a@example.com", "b@example.com"],
          notifyOnCreate: false,
          notifyOwnerOnCreate: true,
          notifyOwnerOnStageChange: true,
          updatedById: "actor-123",
        }),
        update: expect.objectContaining({
          notifyEmails: ["a@example.com", "b@example.com"],
          notifyOnCreate: false,
          notifyOwnerOnCreate: true,
          notifyOwnerOnStageChange: true,
          updatedById: "actor-123",
        }),
      });
      expect(result.data).toEqual({
        notifyEmails: ["a@example.com", "b@example.com"],
        notifyOnCreate: false,
        notifyOwnerOnCreate: true,
        notifyOwnerOnStageChange: true,
        updatedAt: updatedAt.toISOString(),
      });
    });
  });
});
