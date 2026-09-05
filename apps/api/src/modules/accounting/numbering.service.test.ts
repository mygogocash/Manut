import type { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import {
  allocateDocumentNumber,
  allocateDraftNumber,
  computePeriod,
  formatDocNumber,
  MONTHLY_SEQ_MAX,
} from "@/modules/accounting/numbering.service";

interface SeqRow {
  entityId: string;
  docType: string;
  prefix: string;
  padWidth: number;
  resetPeriod: string;
  periodKey: string;
  nextNumber: number;
  createdAt: Date;
}

function rowKey(entityId: string, docType: string, periodKey: string) {
  return `${entityId}:${docType}:${periodKey}`;
}

function makeTx(seed: SeqRow[] = []) {
  const rows = new Map<string, SeqRow>();
  for (const row of seed) {
    rows.set(rowKey(row.entityId, row.docType, row.periodKey), { ...row });
  }

  const tx = {
    documentSequence: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: { entityId: string; docType: string };
        orderBy?: { createdAt: "asc" | "desc" };
      }) => {
        const matches = [...rows.values()].filter(
          (r) => r.entityId === where.entityId && r.docType === where.docType,
        );
        matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (orderBy?.createdAt === "desc") matches.reverse();
        return matches[0] ?? null;
      },
      findUnique: async ({
        where: {
          entityId_docType_periodKey: { entityId, docType, periodKey },
        },
      }: {
        where: {
          entityId_docType_periodKey: {
            entityId: string;
            docType: string;
            periodKey: string;
          };
        };
      }) => rows.get(rowKey(entityId, docType, periodKey)) ?? null,
      upsert: async ({
        where: {
          entityId_docType_periodKey: { entityId, docType, periodKey },
        },
        create,
        update,
      }: {
        where: {
          entityId_docType_periodKey: {
            entityId: string;
            docType: string;
            periodKey: string;
          };
        };
        create: SeqRow;
        update: { nextNumber: { increment: number } };
      }) => {
        const k = rowKey(entityId, docType, periodKey);
        const existing = rows.get(k);
        if (existing) {
          existing.nextNumber += update.nextNumber.increment;
          return existing;
        }
        const created = { ...create };
        rows.set(k, created);
        return created;
      },
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, rows };
}

const july = new Date("2026-07-31T00:00:00.000Z");
const august = new Date("2026-08-18T00:00:00.000Z");

describe("formatDocNumber (PRD monthly tokens)", () => {
  it("renders JE202607032 from prefix + YYYYMM + 3-digit seq", () => {
    const period = computePeriod("monthly", july);
    expect(formatDocNumber("JE{YYYY}{MM}", 32, 3, period)).toBe("JE202607032");
  });

  it("keeps untokenised prefixes unchanged", () => {
    expect(formatDocNumber("PO-", 123456, 5)).toBe("PO-123456");
  });
});

describe("allocateDocumentNumber PRD overlay", () => {
  it("issues JE202607001 then JE202607002 for July documents", async () => {
    const { tx } = makeTx();
    await expect(allocateDocumentNumber(tx, "ent-1", "je", july)).resolves.toBe(
      "JE202607001",
    );
    await expect(allocateDocumentNumber(tx, "ent-1", "je", july)).resolves.toBe(
      "JE202607002",
    );
  });

  it("uses the document date month, not the issue clock", async () => {
    const { tx } = makeTx();
    await allocateDocumentNumber(tx, "ent-1", "je", july);
    await allocateDocumentNumber(tx, "ent-1", "je", july);
    // Dated July, allocated in August — still the July series.
    await expect(allocateDocumentNumber(tx, "ent-1", "je", july)).resolves.toBe(
      "JE202607003",
    );
    await expect(
      allocateDocumentNumber(tx, "ent-1", "je", august),
    ).resolves.toBe("JE202608001");
  });

  it("issues JE202607032 after JE202607031 for a July document dated after month-end", async () => {
    const { tx } = makeTx([
      {
        entityId: "ent-1",
        docType: "je",
        prefix: "JE{YYYY}{MM}",
        padWidth: 3,
        resetPeriod: "monthly",
        periodKey: "202607",
        nextNumber: 32,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    await expect(allocateDocumentNumber(tx, "ent-1", "je", july)).resolves.toBe(
      "JE202607032",
    );
  });

  it("does not consume a period number when issuing DRAFT-000123", async () => {
    const { tx, rows } = makeTx();
    await expect(allocateDraftNumber(tx, "ent-1", "je")).resolves.toBe(
      "DRAFT-000001",
    );
    await expect(allocateDraftNumber(tx, "ent-1", "je")).resolves.toBe(
      "DRAFT-000002",
    );
    await expect(allocateDocumentNumber(tx, "ent-1", "je", july)).resolves.toBe(
      "JE202607001",
    );
    expect(rows.get(rowKey("ent-1", "je-draft", ""))?.nextNumber).toBe(3);
    expect(rows.get(rowKey("ent-1", "je", "202607"))?.nextNumber).toBe(2);
  });

  it("never reuses a cancelled number (sequence only increments)", async () => {
    const { tx } = makeTx();
    await expect(
      allocateDocumentNumber(tx, "ent-1", "je", august),
    ).resolves.toBe("JE202608001");
    // Cancel would keep JE202608001 reserved; the next issue is 002.
    await expect(
      allocateDocumentNumber(tx, "ent-1", "je", august),
    ).resolves.toBe("JE202608002");
  });

  it("blocks the 1000th issue in a month", async () => {
    const { tx } = makeTx([
      {
        entityId: "ent-1",
        docType: "je",
        prefix: "JE{YYYY}{MM}",
        padWidth: 3,
        resetPeriod: "monthly",
        periodKey: "202608",
        nextNumber: MONTHLY_SEQ_MAX + 1,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);
    await expect(
      allocateDocumentNumber(tx, "ent-1", "je", august),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("ignores a legacy ever-growing JE- row and still issues monthly numbers", async () => {
    const { tx } = makeTx([
      {
        entityId: "ent-1",
        docType: "je",
        prefix: "JE-",
        padWidth: 6,
        resetPeriod: "none",
        periodKey: "",
        nextNumber: 99,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    await expect(allocateDocumentNumber(tx, "ent-1", "je", july)).resolves.toBe(
      "JE202607001",
    );
  });

  it("uses INV / RCP / EXP monthly prefixes for statutory AR/AP types", async () => {
    const { tx } = makeTx();
    await expect(
      allocateDocumentNumber(tx, "ent-1", "invoice", august),
    ).resolves.toBe("INV202608001");
    await expect(
      allocateDocumentNumber(tx, "ent-1", "receipt", august),
    ).resolves.toBe("RCP202608001");
    await expect(
      allocateDocumentNumber(tx, "ent-1", "bill", august),
    ).resolves.toBe("EXP202608001");
    await expect(allocateDraftNumber(tx, "ent-1", "invoice")).resolves.toBe(
      "DRAFT-INV-000001",
    );
  });

  it("leaves non-statutory types on their existing ever-growing format", async () => {
    const { tx } = makeTx();
    await expect(
      allocateDocumentNumber(tx, "ent-1", "quote", august),
    ).resolves.toBe("QT-00001");
    await expect(
      allocateDocumentNumber(tx, "ent-1", "po", august),
    ).resolves.toBe("PO-00001");
  });
});
