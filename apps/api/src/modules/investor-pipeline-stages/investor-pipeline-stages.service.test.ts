import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { investorPipelineStageRepository } from "@/modules/investor-pipeline-stages/investor-pipeline-stages.repository";
import { InvestorPipelineStageService } from "@/modules/investor-pipeline-stages/investor-pipeline-stages.service";

vi.mock(
  "@/modules/investor-pipeline-stages/investor-pipeline-stages.repository",
  () => ({
    investorPipelineStageRepository: {
      findAll: vi.fn(),
      findByKey: vi.fn(),
      count: vi.fn(),
      maxSortOrder: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteAndReassign: vi.fn(),
      applySortOrder: vi.fn(),
    },
  }),
);

const findAll = investorPipelineStageRepository.findAll as Mock;
const findByKey = investorPipelineStageRepository.findByKey as Mock;
const maxSortOrder = investorPipelineStageRepository.maxSortOrder as Mock;
const create = investorPipelineStageRepository.create as Mock;
const deleteAndReassign =
  investorPipelineStageRepository.deleteAndReassign as Mock;
const service = new InvestorPipelineStageService();

beforeEach(() => {
  vi.resetAllMocks();
});

describe("InvestorPipelineStageService.create", () => {
  it("slugifies the label into a key and appends after the last stage", async () => {
    findByKey.mockResolvedValue(null);
    maxSortOrder.mockResolvedValue(3);
    create.mockResolvedValue({ key: "due_diligence" });
    await service.create({ label: "Due Diligence" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: "due_diligence", sortOrder: 4 }),
    );
  });

  it("suffixes the key on collision", async () => {
    findByKey
      .mockResolvedValueOnce({ key: "lead" })
      .mockResolvedValueOnce(null);
    maxSortOrder.mockResolvedValue(0);
    create.mockResolvedValue({ key: "lead_1" });
    await service.create({ label: "Lead" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: "lead_1" }),
    );
  });
});

describe("InvestorPipelineStageService.delete", () => {
  it("reassigns investors to the first remaining stage", async () => {
    findAll.mockResolvedValue([
      { key: "investors" },
      { key: "lead" },
      { key: "dd" },
    ]);
    deleteAndReassign.mockResolvedValue(undefined);
    const res = await service.delete("dd");
    expect(deleteAndReassign).toHaveBeenCalledWith("dd", "investors");
    expect(res.reassignedTo).toBe("investors");
  });

  it("refuses to delete the last stage", async () => {
    findAll.mockResolvedValue([{ key: "only" }]);
    await expect(service.delete("only")).rejects.toThrow(BadRequestException);
    expect(deleteAndReassign).not.toHaveBeenCalled();
  });

  it("404s on an unknown stage", async () => {
    findAll.mockResolvedValue([{ key: "a" }, { key: "b" }]);
    await expect(service.delete("ghost")).rejects.toThrow(NotFoundException);
  });
});

describe("InvestorPipelineStageService.reorder", () => {
  it("drops unknown keys from the payload before applying", async () => {
    findAll.mockResolvedValue([{ key: "a" }, { key: "b" }]);
    await service.reorder({ orderedKeys: ["b", "ghost", "a"] });
    expect(investorPipelineStageRepository.applySortOrder).toHaveBeenCalledWith(
      ["b", "a"],
    );
  });
});
