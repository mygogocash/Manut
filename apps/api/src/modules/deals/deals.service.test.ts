import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { dealRepository } from "@/modules/deals/deals.repository";
import { DealService } from "@/modules/deals/deals.service";

vi.mock("@/modules/deals/deals.repository", () => ({
  dealRepository: {
    findMany: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockImplementation((id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue({ id: "deal-1" }),
    pipelineSummary: vi.fn().mockResolvedValue([]),
  },
}));

// Analytics module is best-effort and not under test here.
vi.mock("@/lib/events", () => ({
  actorFromId: vi.fn().mockResolvedValue(null),
  trackDealCreatedServer: vi.fn(),
  trackDealLost: vi.fn(),
  trackDealStageChangedServer: vi.fn(),
  trackDealWon: vi.fn(),
}));

describe("DealService — owner scoping (#519)", () => {
  let service: DealService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DealService();
  });

  describe("list", () => {
    it("restricts to the caller's own deals when they lack crm:team-read", async () => {
      await service.list("user-a", [], {
        page: 1,
        limit: 20,
      });

      expect(dealRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ ownerScope: ["user-a"] }),
        1,
        20,
      );
    });

    it("returns the unscoped list when the caller holds crm:team-read", async () => {
      await service.list("user-a", ["crm:team-read"], {
        page: 1,
        limit: 20,
      });

      expect(dealRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ ownerScope: undefined }),
        1,
        20,
      );
    });
  });

  describe("getById", () => {
    it("returns the deal when the caller owns it", async () => {
      (dealRepository.findById as Mock).mockResolvedValue({
        id: "d-1",
        ownerId: "user-a",
        stage: "lead",
      });
      const result = await service.getById("d-1", "user-a", []);
      expect(result.id).toBe("d-1");
    });

    it("masks as 404 when the caller is not the owner and lacks crm:team-read", async () => {
      (dealRepository.findById as Mock).mockResolvedValue({
        id: "d-1",
        ownerId: "user-a",
        stage: "lead",
      });
      // 404 (not 403) is deliberate — matches leads pattern, avoids
      // leaking row existence to non-owners.
      await expect(service.getById("d-1", "user-b", [])).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns the deal when the caller has crm:team-read", async () => {
      (dealRepository.findById as Mock).mockResolvedValue({
        id: "d-1",
        ownerId: "user-a",
        stage: "lead",
      });
      const result = await service.getById("d-1", "user-b", ["crm:team-read"]);
      expect(result.id).toBe("d-1");
    });

    it("404s when the deal does not exist (regression — unchanged behaviour)", async () => {
      (dealRepository.findById as Mock).mockResolvedValue(null);
      await expect(
        service.getById("missing", "user-a", ["crm:team-read"]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("update", () => {
    it("blocks non-owner updates without crm:team-read (masked as 404)", async () => {
      (dealRepository.findById as Mock).mockResolvedValue({
        id: "d-1",
        ownerId: "user-a",
        stage: "lead",
      });
      await expect(
        service.update("d-1", "user-b", [], { notes: "hack" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      // No write side-effect when the auth check fails.
      expect(dealRepository.update).not.toHaveBeenCalled();
    });

    it("allows the owner to update", async () => {
      (dealRepository.findById as Mock).mockResolvedValue({
        id: "d-1",
        ownerId: "user-a",
        stage: "lead",
      });
      await service.update("d-1", "user-a", [], { notes: "updated" });
      expect(dealRepository.update).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("blocks non-owner deletes without crm:team-read", async () => {
      (dealRepository.findById as Mock).mockResolvedValue({
        id: "d-1",
        ownerId: "user-a",
        stage: "lead",
      });
      await expect(service.delete("d-1", "user-b", [])).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(dealRepository.delete).not.toHaveBeenCalled();
    });

    it("allows the owner to delete", async () => {
      (dealRepository.findById as Mock).mockResolvedValue({
        id: "d-1",
        ownerId: "user-a",
        stage: "lead",
      });
      await service.delete("d-1", "user-a", []);
      expect(dealRepository.delete).toHaveBeenCalledWith("d-1");
    });
  });

  describe("getPipelineSummary", () => {
    it("scopes pipeline rollup to the caller's own deals without crm:team-read", async () => {
      await service.getPipelineSummary("user-a", []);
      expect(dealRepository.pipelineSummary).toHaveBeenCalledWith(["user-a"]);
    });

    it("returns the workspace-wide rollup with crm:team-read", async () => {
      await service.getPipelineSummary("user-a", ["crm:team-read"]);
      expect(dealRepository.pipelineSummary).toHaveBeenCalledWith(undefined);
    });
  });
});
