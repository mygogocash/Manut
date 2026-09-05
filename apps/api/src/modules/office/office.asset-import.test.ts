import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { officeRepository } from "@/modules/office/office.repository";
import {
  naturalAssetKey,
  OfficeService,
} from "@/modules/office/office.service";
import type { AssetImportRow } from "@/modules/office/office.validation";

vi.mock("@/infrastructure/audit/audit.service", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    entity: { findMany: vi.fn() },
    asset: { findMany: vi.fn() },
    office: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/modules/office/office.repository", () => ({
  officeRepository: {
    createAsset: vi.fn(),
    updateAsset: vi.fn(),
  },
}));

const userFindMany = prisma.user.findMany as unknown as Mock;
const entityFindMany = prisma.entity.findMany as unknown as Mock;
const assetFindMany = prisma.asset.findMany as unknown as Mock;
const officeFindMany = prisma.office.findMany as unknown as Mock;
const officeFindFirst = prisma.office.findFirst as unknown as Mock;
const officeFindUnique = prisma.office.findUnique as unknown as Mock;
const officeCreate = prisma.office.create as unknown as Mock;
const createAsset = officeRepository.createAsset as Mock;
const updateAsset = officeRepository.updateAsset as Mock;

const service = new OfficeService();
const OFFICE_ID = "office-bkk";

/** One row as the Asset Inventory Tracker mapper produces it. */
function row(over: Partial<AssetImportRow> = {}): AssetImportRow {
  return {
    type: "furniture",
    name: "Marble Table",
    supplier: "Index Living Mall Public Company Limited",
    purchaseDate: "2024-03-20",
    purchaseCost: 17990,
    quantity: 1,
    locationDetail: "Office",
    status: "available",
    sourceSheet: "Asset Inventory",
    ...over,
  } as AssetImportRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindMany.mockResolvedValue([]);
  entityFindMany.mockResolvedValue([]);
  assetFindMany.mockResolvedValue([]);
  officeFindMany.mockResolvedValue([
    { id: OFFICE_ID, name: "Bangkok HQ", country: "Thailand" },
  ]);
  officeFindFirst.mockResolvedValue(null);
  officeFindUnique.mockResolvedValue({ id: OFFICE_ID });
  createAsset.mockResolvedValue({ id: "new-asset" });
  updateAsset.mockResolvedValue({ id: "matched-asset" });
});

describe("naturalAssetKey", () => {
  it("is stable across Date and ISO-string forms of the same day", () => {
    expect(naturalAssetKey(OFFICE_ID, "Marble Table", "2024-03-20")).toBe(
      naturalAssetKey(
        OFFICE_ID,
        "Marble Table",
        new Date("2024-03-20T00:00:00.000Z"),
      ),
    );
  });

  it("normalises case and inner whitespace, which a sheet is careless about", () => {
    expect(naturalAssetKey(OFFICE_ID, "  marble   TABLE ", "2024-03-20")).toBe(
      naturalAssetKey(OFFICE_ID, "Marble Table", "2024-03-20"),
    );
  });

  it("is null without a purchase date, because (office, name) is not distinctive", () => {
    // Two identical chairs bought on different days are two assets; collapsing
    // them on name alone would silently overwrite the first.
    expect(naturalAssetKey(OFFICE_ID, "Dining Chair", null)).toBeNull();
    expect(naturalAssetKey(null, "Dining Chair", "2024-03-20")).toBeNull();
  });
});

describe("commitAssetImport persists the fixed-asset columns", () => {
  it("writes supplier, date, unit cost, quantity and location", async () => {
    // The defect this covers: the schema accepted these and the commit dropped
    // every one of them, so a purchase log arrived as bare names.
    await service.commitAssetImport([row()], { officeId: OFFICE_ID });
    expect(createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: OFFICE_ID,
        name: "Marble Table",
        type: "furniture",
        supplier: "Index Living Mall Public Company Limited",
        purchaseDate: new Date("2024-03-20T00:00:00.000Z"),
        purchaseCost: 17990,
        quantity: 1,
        locationDetail: "Office",
      }),
    );
  });

  it("keeps purchaseCost as the UNIT price on a quantity-2 row", async () => {
    // quantity x purchaseCost must reproduce the sheet's Total Value; storing
    // the total here would double the asset register for these rows.
    await service.commitAssetImport(
      [row({ name: "Air purifier", quantity: 2, purchaseCost: 9252.34 })],
      { officeId: OFFICE_ID },
    );
    const data = createAsset.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(data.quantity).toBe(2);
    expect(data.purchaseCost).toBe(9252.34);
  });

  it("carries the furniture metadata when the sheet has it", async () => {
    await service.commitAssetImport(
      [
        row({
          material: "Oak",
          dimensions: "W120 x D60 x H75 cm",
          condition: "good",
        }),
      ],
      { officeId: OFFICE_ID },
    );
    expect(createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        material: "Oak",
        dimensions: "W120 x D60 x H75 cm",
        condition: "good",
      }),
    );
  });
});

describe("import idempotency", () => {
  it("updates rather than duplicates on a second pass, with no serial number", async () => {
    // Furniture has no serial, and serial was the ONLY match key — so every
    // re-import of this sheet used to insert a full second copy.
    assetFindMany.mockResolvedValue([
      {
        id: "existing-1",
        serialNo: null,
        assetCode: null,
        officeId: OFFICE_ID,
        name: "Marble Table",
        purchaseDate: new Date("2024-03-20T00:00:00.000Z"),
      },
    ]);
    const result = await service.commitAssetImport([row()], {
      officeId: OFFICE_ID,
    });
    expect(updateAsset).toHaveBeenCalledWith(
      "existing-1",
      expect.objectContaining({ name: "Marble Table" }),
    );
    expect(createAsset).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ inserts: 0, updates: 1 }));
  });

  it("prefers an explicit asset code over the name-and-date heuristic", async () => {
    assetFindMany.mockResolvedValue([
      {
        id: "by-code",
        serialNo: null,
        assetCode: "FA-0001",
        officeId: OFFICE_ID,
        name: "Something Else Entirely",
        purchaseDate: null,
      },
      {
        id: "by-natural",
        serialNo: null,
        assetCode: null,
        officeId: OFFICE_ID,
        name: "Marble Table",
        purchaseDate: new Date("2024-03-20T00:00:00.000Z"),
      },
    ]);
    await service.commitAssetImport([row({ assetCode: "FA-0001" })], {
      officeId: OFFICE_ID,
    });
    expect(updateAsset).toHaveBeenCalledWith("by-code", expect.anything());
  });

  it("does not overwrite a supplied asset code with a derived one", async () => {
    await service.commitAssetImport([row({ assetCode: "FA-0001" })], {
      officeId: OFFICE_ID,
    });
    const data = createAsset.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(data.assetCode).toBe("FA-0001");
  });

  it("inserts twice for two rows in ONE file sharing a key", async () => {
    // Two rows colliding inside one file are two assets that happen to match,
    // not the same asset twice — the second must not update what the first made.
    const result = await service.commitAssetImport([row(), row()], {
      officeId: OFFICE_ID,
    });
    expect(result.inserts).toBe(2);
    expect(result.updates).toBe(0);
  });

  it("treats a row with no purchase date as an insert every time", async () => {
    assetFindMany.mockResolvedValue([
      {
        id: "existing-1",
        serialNo: null,
        assetCode: null,
        officeId: OFFICE_ID,
        name: "Whiteboard Tempered",
        purchaseDate: null,
      },
    ]);
    const result = await service.commitAssetImport(
      [row({ name: "Whiteboard Tempered", purchaseDate: null })],
      { officeId: OFFICE_ID },
    );
    // No key to match on, so it inserts. Worth knowing: a dateless row cannot
    // be made idempotent without an asset code.
    expect(result.inserts).toBe(1);
  });
});

describe("office targeting", () => {
  it("uses the explicit officeId for every row", async () => {
    officeFindUnique.mockResolvedValue({ id: "office-other" });
    await service.commitAssetImport([row()], { officeId: "office-other" });
    expect(createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: "office-other" }),
    );
  });

  it("creates the office from name + city + country when it does not exist", async () => {
    officeFindFirst.mockResolvedValue(null);
    officeCreate.mockResolvedValue({ id: "office-new" });
    await service.commitAssetImport([row()], {
      name: "Bangkok HQ",
      city: "Bangkok",
      country: "Thailand",
    });
    expect(officeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Bangkok HQ",
          city: "Bangkok",
          country: "Thailand",
        }),
      }),
    );
  });

  it("reuses an office of that name instead of creating a second", async () => {
    officeFindFirst.mockResolvedValue({ id: OFFICE_ID });
    await service.commitAssetImport([row()], {
      name: "Bangkok HQ",
      city: "Bangkok",
      country: "Thailand",
    });
    expect(officeCreate).not.toHaveBeenCalled();
    expect(createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: OFFICE_ID }),
    );
  });

  it("preview never creates an office — an abandoned dialog must leave nothing", async () => {
    officeFindFirst.mockResolvedValue(null);
    await service.previewAssetImport([row()], {
      name: "Somewhere New",
      city: "Bangkok",
      country: "Thailand",
    });
    expect(officeCreate).not.toHaveBeenCalled();
  });
});

describe("an update writes only what the row carried", () => {
  // Found by adversarial review. The commit built ONE payload with `?? null` for
  // every column (correct for a create) and passed it to the update too — so a
  // re-import of a sheet with ten columns wiped every other field on the asset.
  // The (office, name, date) match tier added for furniture is precisely what
  // made that reachable, since before it a row with no serial matched nothing.
  const enriched = {
    id: "existing-1",
    serialNo: null,
    assetCode: "FA-014",
    officeId: OFFICE_ID,
    name: "Marble Table",
    purchaseDate: new Date("2024-03-20T00:00:00.000Z"),
  };

  beforeEach(() => {
    assetFindMany.mockResolvedValue([enriched]);
  });

  it("does not null the fields the sheet has no column for", async () => {
    await service.commitAssetImport([row()], { officeId: OFFICE_ID });
    const data = updateAsset.mock.calls[0]?.[1] as Record<string, unknown>;
    for (const field of [
      "material",
      "dimensions",
      "warrantyUntil",
      "serialNo",
      "assignedTo",
      "manufacturer",
      "model",
      "notes",
      "assetCode",
    ]) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it("still writes the fields the sheet DOES carry", async () => {
    await service.commitAssetImport([row()], { officeId: OFFICE_ID });
    expect(updateAsset).toHaveBeenCalledWith(
      "existing-1",
      expect.objectContaining({
        name: "Marble Table",
        supplier: "Index Living Mall Public Company Limited",
        purchaseCost: 17990,
        locationDetail: "Office",
      }),
    );
  });

  it("does not reset a hand-set status when the sheet has no status column", async () => {
    // The inventory mapper deliberately sends no status, so an asset marked
    // "in-repair" must survive a re-import.
    await service.commitAssetImport([row({ status: undefined })], {
      officeId: OFFICE_ID,
    });
    const data = updateAsset.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(data).not.toHaveProperty("status");
  });

  it("writes status when the sheet DOES supply one", async () => {
    await service.commitAssetImport([row({ status: "in-repair" })], {
      officeId: OFFICE_ID,
    });
    expect(updateAsset).toHaveBeenCalledWith(
      "existing-1",
      expect.objectContaining({ status: "in-repair" }),
    );
  });

  it("never relocates the asset's office on an update", async () => {
    // A code or serial match can span offices; silently moving the asset is not
    // something an import should decide.
    await service.commitAssetImport([row()], { officeId: OFFICE_ID });
    const data = updateAsset.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(data).not.toHaveProperty("officeId");
  });

  it("sets every column on a CREATE, which is why the payloads differ", async () => {
    assetFindMany.mockResolvedValue([]);
    await service.commitAssetImport([row()], { officeId: OFFICE_ID });
    const data = createAsset.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(data).toHaveProperty("material", null);
    expect(data).toHaveProperty("officeId", OFFICE_ID);
  });
});

describe("preview of an office that does not exist yet", () => {
  // Found by adversarial review. Preview resolved a not-yet-created office to
  // null, the caller fell back to "the first active office", and every natural
  // key was computed against THAT office's assets — so a preview could promise
  // 24 updates and the commit then insert 24 rows, from identical input.
  it("counts every row as an insert, not against the fallback office's assets", async () => {
    assetFindMany.mockResolvedValue([
      {
        id: "in-fallback-office",
        serialNo: null,
        assetCode: null,
        officeId: OFFICE_ID,
        name: "Marble Table",
        purchaseDate: new Date("2024-03-20T00:00:00.000Z"),
      },
    ]);
    officeFindFirst.mockResolvedValue(null);

    const { summary, rows } = await service.previewAssetImport([row()], {
      name: "Brand New Office",
      city: "Bangkok",
      country: "Thailand",
    });

    expect(summary.updates).toBe(0);
    expect(summary.inserts).toBe(1);
    expect(rows[0]?.warnings).toContain("office_will_be_created");
    expect(officeCreate).not.toHaveBeenCalled();
  });

  it("still matches normally when the named office already exists", async () => {
    officeFindFirst.mockResolvedValue({ id: OFFICE_ID });
    assetFindMany.mockResolvedValue([
      {
        id: "existing-1",
        serialNo: null,
        assetCode: null,
        officeId: OFFICE_ID,
        name: "Marble Table",
        purchaseDate: new Date("2024-03-20T00:00:00.000Z"),
      },
    ]);
    const { summary } = await service.previewAssetImport([row()], {
      name: "Bangkok HQ",
      city: "Bangkok",
      country: "Thailand",
    });
    expect(summary.updates).toBe(1);
    expect(summary.inserts).toBe(0);
  });
});
