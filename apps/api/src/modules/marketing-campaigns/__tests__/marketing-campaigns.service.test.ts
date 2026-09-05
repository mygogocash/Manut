import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { marketingCampaignsRepository as repo } from "@/modules/marketing-campaigns/marketing-campaigns.repository";
import { MarketingCampaignsService } from "@/modules/marketing-campaigns/marketing-campaigns.service";

vi.mock("@/infrastructure/audit/audit.service", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../marketing-campaigns.repository", () => ({
  marketingCampaignsRepository: {
    list: vi.fn(),
    count: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setCampaignLevers: vi.fn(),
    validLeverIds: vi.fn(),
    latestCreativeVersion: vi.fn(),
    createCreative: vi.fn(),
    findCreative: vi.fn(),
    createPrediction: vi.fn(),
  },
}));

const findById = repo.findById as Mock;
const create = repo.create as Mock;
const setCampaignLevers = repo.setCampaignLevers as Mock;
const validLeverIds = repo.validLeverIds as Mock;
const latestCreativeVersion = repo.latestCreativeVersion as Mock;
const createCreative = repo.createCreative as Mock;

const service = new MarketingCampaignsService();
const ACTOR = "11111111-1111-1111-1111-111111111111";

function detail(over: Record<string, unknown> = {}) {
  return {
    id: "camp-1",
    name: "Launch",
    campaignDate: new Date("2026-07-01T00:00:00Z"),
    hours: 2,
    ownerId: null,
    owner: null,
    status: "planned",
    country: "TH",
    product: "App",
    channel: "Push",
    campaignType: "Awareness",
    objective: null,
    targetAudience: null,
    expectedReach: 1000,
    actualReach: null,
    budget: null,
    currency: "USD",
    notes: null,
    createdBy: { id: ACTOR, name: "A", email: "a@x.com" },
    levers: [],
    creatives: [],
    predictions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("create", () => {
  it("validates lever ids and persists the multi-select", async () => {
    create.mockResolvedValue(detail());
    validLeverIds.mockResolvedValue([{ id: "l1" }, { id: "l2" }]);
    findById.mockResolvedValue(detail());
    await service.create(
      {
        name: "Launch",
        campaignDate: "2026-07-01",
        status: "planned",
        currency: "USD",
        leverIds: ["l1", "l2"],
      },
      ACTOR,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Launch", createdById: ACTOR }),
    );
    expect(setCampaignLevers).toHaveBeenCalledWith("camp-1", ["l1", "l2"]);
  });

  it("rejects unknown lever ids", async () => {
    validLeverIds.mockResolvedValue([{ id: "l1" }]); // only 1 of 2 found
    await expect(
      service.create(
        {
          name: "X",
          campaignDate: "2026-07-01",
          status: "planned",
          currency: "USD",
          leverIds: ["l1", "l2"],
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("getById", () => {
  it("throws NotFound when missing", async () => {
    findById.mockResolvedValue(null);
    await expect(service.getById("nope")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("maps levers + budget in the DTO", async () => {
    findById.mockResolvedValue(
      detail({
        budget: 1500,
        levers: [{ lever: { id: "l1", name: "Push" } }],
      }),
    );
    const { data } = await service.getById("camp-1");
    expect(data.budget).toBe(1500);
    expect(data.levers).toEqual([{ id: "l1", name: "Push" }]);
  });
});

describe("addCreative", () => {
  it("assigns the next version number (history)", async () => {
    findById.mockResolvedValue(detail());
    latestCreativeVersion.mockResolvedValue({ _max: { version: 2 } });
    createCreative.mockResolvedValue({
      id: "cr-1",
      version: 3,
      createdAt: new Date(),
    });
    await service.addCreative(
      "camp-1",
      {
        kind: "image",
        source: "upload",
        name: "banner.png",
        url: "https://x/banner.png",
      },
      ACTOR,
    );
    expect(createCreative).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3, campaignId: "camp-1" }),
    );
  });

  it("starts at version 1 when no creatives exist", async () => {
    findById.mockResolvedValue(detail());
    latestCreativeVersion.mockResolvedValue({ _max: { version: null } });
    createCreative.mockResolvedValue({
      id: "cr-1",
      version: 1,
      createdAt: new Date(),
    });
    await service.addCreative(
      "camp-1",
      { kind: "link", source: "figma", name: "Figma", url: "https://figma/x" },
      ACTOR,
    );
    expect(createCreative).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1 }),
    );
  });

  it("throws NotFound for a missing campaign", async () => {
    findById.mockResolvedValue(null);
    await expect(
      service.addCreative(
        "nope",
        { kind: "pdf", source: "upload", name: "x", url: "https://x/x.pdf" },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
