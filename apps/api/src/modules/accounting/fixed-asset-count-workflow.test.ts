import { Prisma } from "@nexora/database";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ConflictException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";
import { allocateDocumentNumber } from "@/modules/accounting/numbering.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    findFixedAssetCountSessionById: vi.fn(),
    findFixedAssetCountLines: vi.fn(),
    createFixedAssetCountLine: vi.fn(),
    findFixedAssetsForReport: vi.fn(),
    findApprovedDisposals: vi.fn(),
    findApprovedRemeasurements: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock("@/modules/accounting/numbering.service", () => ({
  allocateDocumentNumber: vi.fn(),
}));

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const READ_ALL = ["accounting:read-all"];
const ACTOR = "user-1";

/** Session dated 31-Dec; the count itself is walked in mid-January. */
const SESSION = {
  id: "sess-1",
  entityId: "entity-1",
  sessionNo: "FAC-2025-0001",
  asOfDate: d("2025-12-31"),
  name: "Year-end 2025",
  locationFilter: null,
  status: "open",
  createdBy: ACTOR,
  closedBy: null,
  closedAt: null,
  createdAt: d("2026-01-10"),
};

/**
 * Live row AFTER a partial disposal that happened on 15-Jan-2026: 6 of the
 * original 10 units are gone and the cost was scaled down with them.
 */
const CHAIRS = {
  id: "a1",
  entityId: "entity-1",
  assetNo: "FA-FF-2026-001",
  name: "Office chair",
  categoryCode: "FF",
  location: "HQ 3F",
  serialNo: "SN-CHAIR",
  quantity: 4,
  purchasePrice: new Prisma.Decimal("40000.00"),
  startDate: d("2024-01-01"),
  usefulLifeMonths: 60,
  openingBookValue: null,
  openingAsOfDate: null,
  status: "active",
  disposalDate: null,
  createdBy: ACTOR,
};

/** The snapshot that disposal wrote: 10 units at 100,000 immediately before. */
const PARTIAL_DISPOSAL = {
  assetId: "a1",
  disposalDate: d("2026-01-15"),
  quantityBefore: 10,
  costBefore: new Prisma.Decimal("100000.00"),
  openingBookValueBefore: null,
};

/** Two assets sharing one serial number — imports never de-duplicate them. */
const DUP_A = {
  ...CHAIRS,
  id: "a2",
  assetNo: "FA-IT-2026-009",
  name: "Monitor A",
  categoryCode: "IT",
  serialNo: "DUP-42",
  quantity: 1,
  purchasePrice: new Prisma.Decimal("9000.00"),
};
const DUP_B = {
  ...DUP_A,
  id: "a3",
  assetNo: "FA-IT-2026-010",
  name: "Monitor B",
  // Same serial, different case — normalizeTag collapses them.
  serialNo: "dup-42",
};

function mockRegister(assets: unknown[], disposals: unknown[] = []) {
  (accountingRepository.findFixedAssetsForReport as Mock).mockResolvedValue(
    assets,
  );
  (accountingRepository.findApprovedDisposals as Mock).mockResolvedValue(
    disposals,
  );
  // The event chain now folds in approved remeasurements too (WS2); this suite
  // exercises the disposal half of it.
  (accountingRepository.findApprovedRemeasurements as Mock).mockResolvedValue(
    [],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (
    accountingRepository.findFixedAssetCountSessionById as Mock
  ).mockResolvedValue(SESSION);
  (accountingRepository.findFixedAssetCountLines as Mock).mockResolvedValue([]);
  (accountingRepository.createFixedAssetCountLine as Mock).mockImplementation(
    (data: Record<string, unknown>) =>
      Promise.resolve({ id: "line-1", ...data }),
  );
  mockRegister([CHAIRS]);
});

describe("count session numbering", () => {
  it("allocates the session number from the fa-count sequence", async () => {
    const tx = {
      fixedAssetCountSession: {
        create: vi.fn().mockResolvedValue({ ...SESSION }),
      },
    };
    (prisma.$transaction as Mock).mockImplementation(
      (fn: (t: unknown) => unknown) => fn(tx),
    );
    (allocateDocumentNumber as Mock).mockResolvedValue("FAC-2025-0001");

    await accountingService.createFixedAssetCountSession(
      {
        entityId: "entity-1",
        asOfDate: "2025-12-31",
        name: "Year-end 2025",
        locationFilter: null,
      },
      ACTOR,
    );

    // Race-safe, inside the same transaction as the insert, so a rolled-back
    // session never burns a number.
    expect(allocateDocumentNumber).toHaveBeenCalledWith(
      tx,
      "entity-1",
      "fa-count",
    );
    expect(tx.fixedAssetCountSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionNo: "FAC-2025-0001",
          status: "open",
          asOfDate: d("2025-12-31"),
        }),
      }),
    );
  });
});

describe("count line — scanned tag resolution", () => {
  it("refuses an ambiguous tag with a 400 that names the ambiguity", async () => {
    mockRegister([DUP_A, DUP_B]);

    const submit = () =>
      accountingService.submitFixedAssetCountLine(
        "sess-1",
        {
          assetId: null,
          scannedTag: " dup-42 \n",
          countedQuantity: 1,
          note: null,
        },
        ACTOR,
        READ_ALL,
      );

    // 400, not a 500 or a silent best guess — and the message names both the
    // normalised tag and how many assets it hit so the counter can pick one.
    await expect(submit()).rejects.toBeInstanceOf(BadRequestException);
    await expect(submit()).rejects.toThrow(/DUP-42.*matches 2 assets/);

    // Guessing would attach the count to the wrong monitor and the counter
    // would confirm it — so nothing is written at all.
    expect(
      accountingRepository.createFixedAssetCountLine,
    ).not.toHaveBeenCalled();
  });

  it("resolves a tag against the asset code as well as the serial number", async () => {
    mockRegister([CHAIRS]);

    const byCode = await accountingService.submitFixedAssetCountLine(
      "sess-1",
      {
        assetId: null,
        scannedTag: "fa-ff-2026-001",
        countedQuantity: 10,
        note: null,
      },
      ACTOR,
      READ_ALL,
    );
    expect(byCode.assetId).toBe("a1");

    const bySerial = await accountingService.submitFixedAssetCountLine(
      "sess-1",
      {
        assetId: null,
        scannedTag: "SN-CHAIR",
        countedQuantity: 10,
        note: null,
      },
      ACTOR,
      READ_ALL,
    );
    expect(bySerial.assetId).toBe("a1");
  });

  it("does not report an asset as ambiguous with itself", async () => {
    // Imports routinely write the same string into assetNo and serialNo. Two
    // candidate entries for ONE asset is not an ambiguity, and rejecting it
    // would block a perfectly good scan.
    mockRegister([{ ...CHAIRS, serialNo: "FA-FF-2026-001" }]);

    const line = await accountingService.submitFixedAssetCountLine(
      "sess-1",
      {
        assetId: null,
        scannedTag: "FA-FF-2026-001",
        countedQuantity: 10,
        note: null,
      },
      ACTOR,
      READ_ALL,
    );
    expect(line.assetId).toBe("a1");
    expect(line.resolution).toBe("matched");
  });

  it("records an unknown tag as unregistered rather than failing the scan", async () => {
    mockRegister([CHAIRS]);

    const line = await accountingService.submitFixedAssetCountLine(
      "sess-1",
      {
        assetId: null,
        scannedTag: "NOT-IN-REGISTER",
        countedQuantity: 1,
        note: "Printer in meeting room",
      },
      ACTOR,
      READ_ALL,
    );
    expect(line.assetId).toBeNull();
    expect(line.resolution).toBe("unregistered");
    expect(line.expectedQuantity).toBe(0);
  });

  it("refuses to write into a closed session", async () => {
    (
      accountingRepository.findFixedAssetCountSessionById as Mock
    ).mockResolvedValue({ ...SESSION, status: "closed" });

    await expect(
      accountingService.submitFixedAssetCountLine(
        "sess-1",
        {
          assetId: null,
          scannedTag: "SN-CHAIR",
          countedQuantity: 1,
          note: null,
        },
        ACTOR,
        READ_ALL,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      accountingRepository.createFixedAssetCountLine,
    ).not.toHaveBeenCalled();
  });
});

describe("count variance — expectations come from the as-of date", () => {
  it("expects the quantity held on the count date, not the live quantity", async () => {
    // The count is AS AT 31-Dec, when 10 chairs were held. By the time the
    // counter walks the floor a 15-Jan partial disposal has already cut the
    // live row to 4. Sourcing the expectation from the live row would call a
    // correct count of 10 a surplus of 6 and invite a "correction" that is
    // itself the error.
    mockRegister([CHAIRS], [PARTIAL_DISPOSAL]);
    (accountingRepository.findFixedAssetCountLines as Mock).mockResolvedValue([
      {
        id: "line-1",
        assetId: "a1",
        scannedTag: "FA-FF-2026-001",
        expectedQuantity: 10,
        countedQuantity: 10,
        note: null,
      },
    ]);

    const result = await accountingService.getFixedAssetCountVariance(
      "sess-1",
      ACTOR,
      READ_ALL,
    );

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]!.expectedQuantity).toBe(10);
    expect(result.lines[0]!.countedQuantity).toBe(10);
    expect(result.lines[0]!.status).toBe("matched");
    expect(result.lines[0]!.suggestWriteOff).toBe(false);
    expect(result.session.asOfDate).toBe("2025-12-31");
  });

  it("reports a genuine shortfall against the as-of quantity and only suggests a write-off", async () => {
    mockRegister([CHAIRS], [PARTIAL_DISPOSAL]);
    (accountingRepository.findFixedAssetCountLines as Mock).mockResolvedValue([
      {
        id: "line-1",
        assetId: "a1",
        scannedTag: null,
        expectedQuantity: 10,
        countedQuantity: 7,
        note: null,
      },
    ]);

    const result = await accountingService.getFixedAssetCountVariance(
      "sess-1",
      ACTOR,
      READ_ALL,
    );

    expect(result.lines[0]!.variance).toBe(-3);
    expect(result.lines[0]!.status).toBe("shortfall");
    // The recommendation is the ONLY output: the count writes no GL entry and
    // creates no disposal. A human routes this into the write-off flow, which
    // carries approval, maker-checker, the period lock and the snapshot.
    expect(result.lines[0]!.suggestWriteOff).toBe(true);
    expect(result.summary.netUnitsMissing).toBe(3);
  });

  it("stamps a new line's expected quantity from the as-of state", async () => {
    mockRegister([CHAIRS], [PARTIAL_DISPOSAL]);

    const line = await accountingService.submitFixedAssetCountLine(
      "sess-1",
      { assetId: "a1", scannedTag: null, countedQuantity: 10, note: null },
      ACTOR,
      READ_ALL,
    );

    // 10 (held on 31-Dec), not 4 (held today).
    expect(line.expectedQuantity).toBe(10);
    expect(line.countedBy).toBe(ACTOR);
  });

  it("does not expect an asset that had already left the books by the as-of date", async () => {
    // Disposed 30-Jun-2025 — nobody could have counted it on 31-Dec, and
    // expecting it would manufacture a shortfall and a write-off suggestion
    // for an asset that is already off the register.
    mockRegister([
      { ...CHAIRS, status: "disposed", disposalDate: d("2025-06-30") },
    ]);

    const result = await accountingService.getFixedAssetCountVariance(
      "sess-1",
      ACTOR,
      READ_ALL,
    );

    expect(result.lines).toHaveLength(0);
    expect(result.summary.expectedAssets).toBe(0);
  });

  it("still expects an asset disposed AFTER the as-of date", async () => {
    // The inverse trap: a full disposal on 15-Jan sets status/disposalDate on
    // the live row, but the asset was on the floor on 31-Dec and must be
    // counted.
    mockRegister([
      { ...CHAIRS, status: "disposed", disposalDate: d("2026-01-15") },
    ]);

    const result = await accountingService.getFixedAssetCountVariance(
      "sess-1",
      ACTOR,
      READ_ALL,
    );

    expect(result.summary.expectedAssets).toBe(1);
    expect(result.lines[0]!.assetNo).toBe("FA-FF-2026-001");
    expect(result.lines[0]!.status).toBe("not-counted");
  });
});

describe("count RBAC", () => {
  it("scopes the register to the caller's own assets without read-all", async () => {
    await accountingService.getFixedAssetCountVariance("sess-1", ACTOR, [
      "accounting:read",
    ]);
    expect(accountingRepository.findFixedAssetsForReport).toHaveBeenCalledWith(
      "entity-1",
      ACTOR,
    );
  });

  it("refuses a session created by someone else without read-all", async () => {
    (
      accountingRepository.findFixedAssetCountSessionById as Mock
    ).mockResolvedValue({ ...SESSION, createdBy: "someone-else" });

    await expect(
      accountingService.getFixedAssetCountVariance("sess-1", ACTOR, [
        "accounting:read",
      ]),
    ).rejects.toThrow(/only work on count sessions you created/);
  });
});
