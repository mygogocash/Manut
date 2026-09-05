import { and, asc, eq, sql } from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { BadRequestException } from "../http-exception";
import { createCuid } from "../lib/id";

type DbLike = Db | DbTransaction;

export type DocType =
  | "invoice"
  | "bill"
  | "quote"
  | "po"
  | "credit-note"
  | "je"
  | "receipt"
  | "debit-note"
  | "wht-certificate"
  | "payment"
  | "je-draft"
  | "invoice-draft"
  | "fa-it"
  | "fa-pfa"
  | "fa-ff"
  | "fa-count";

export const MONTHLY_SEQ_MAX = 999;

const STATUTORY_MONTHLY = new Set<DocType>(["je", "invoice", "receipt", "bill"]);

export type ResetPeriod = "none" | "monthly" | "annual";

export interface DocPeriod {
  key: string;
  year: string;
  yearShort: string;
  month: string;
}

export const DOC_TYPE_DEFAULTS: Record<
  DocType,
  { prefix: string; padWidth: number; resetPeriod?: ResetPeriod }
> = {
  invoice: { prefix: "INV{YYYY}{MM}", padWidth: 3, resetPeriod: "monthly" },
  bill: { prefix: "EXP{YYYY}{MM}", padWidth: 3, resetPeriod: "monthly" },
  quote: { prefix: "QT-", padWidth: 5 },
  po: { prefix: "PO-", padWidth: 5 },
  "credit-note": { prefix: "CN-", padWidth: 5 },
  je: { prefix: "JE{YYYY}{MM}", padWidth: 3, resetPeriod: "monthly" },
  receipt: { prefix: "RCP{YYYY}{MM}", padWidth: 3, resetPeriod: "monthly" },
  "debit-note": { prefix: "DN-", padWidth: 5 },
  "wht-certificate": { prefix: "WHT-", padWidth: 5 },
  payment: { prefix: "PAY-", padWidth: 5 },
  "je-draft": { prefix: "DRAFT-", padWidth: 6 },
  "invoice-draft": { prefix: "DRAFT-INV-", padWidth: 6 },
  "fa-it": { prefix: "FA-IT-{YYYY}-", padWidth: 3, resetPeriod: "annual" },
  "fa-pfa": { prefix: "FA-PFA-{YYYY}-", padWidth: 3, resetPeriod: "annual" },
  "fa-ff": { prefix: "FA-FF-{YYYY}-", padWidth: 3, resetPeriod: "annual" },
  "fa-count": { prefix: "FAC-{YYYY}-", padWidth: 4, resetPeriod: "annual" },
};

function bangkokParts(now: Date): { year: number; month: number } {
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { year: bkk.getUTCFullYear(), month: bkk.getUTCMonth() + 1 };
}

export function computePeriod(resetPeriod: string, now: Date = new Date()): DocPeriod {
  const { year, month } = bangkokParts(now);
  const yyyy = String(year);
  const yy = yyyy.slice(-2);
  const mm = String(month).padStart(2, "0");
  const key =
    resetPeriod === "monthly"
      ? `${yyyy}${mm}`
      : resetPeriod === "annual"
        ? yyyy
        : "";
  return { key, year: yyyy, yearShort: yy, month: mm };
}

function applyPeriodTokens(prefix: string, period?: DocPeriod): string {
  if (!period) return prefix;
  return prefix
    .replaceAll("{YYYY}", period.year)
    .replaceAll("{YY}", period.yearShort)
    .replaceAll("{MM}", period.month);
}

export function formatDocNumber(
  prefix: string,
  seq: number,
  padWidth: number,
  period?: DocPeriod,
): string {
  const resolvedPrefix = applyPeriodTokens(prefix, period);
  return `${resolvedPrefix}${String(seq).padStart(padWidth, "0")}`;
}

async function readSequenceConfig(
  db: DbLike,
  entityId: string,
  docType: DocType,
  statutory: boolean,
) {
  const def = DOC_TYPE_DEFAULTS[docType];
  if (statutory) {
    return {
      resetPeriod: def.resetPeriod ?? "monthly",
      prefix: def.prefix,
      padWidth: def.padWidth,
    };
  }
  const [config] = await db
    .select({
      resetPeriod: schema.documentSequences.resetPeriod,
      prefix: schema.documentSequences.prefix,
      padWidth: schema.documentSequences.padWidth,
    })
    .from(schema.documentSequences)
    .where(
      and(
        eq(schema.documentSequences.entityId, entityId),
        eq(schema.documentSequences.docType, docType),
      ),
    )
    .orderBy(asc(schema.documentSequences.createdAt))
    .limit(1);
  return {
    resetPeriod: config?.resetPeriod ?? def.resetPeriod ?? "none",
    prefix: config?.prefix ?? def.prefix,
    padWidth: config?.padWidth ?? def.padWidth,
  };
}

export async function allocateDocumentNumber(
  db: DbLike,
  entityId: string,
  docType: DocType,
  documentDate: Date | string = new Date(),
): Promise<string> {
  const def = DOC_TYPE_DEFAULTS[docType];
  const statutory = STATUTORY_MONTHLY.has(docType);
  const date =
    typeof documentDate === "string"
      ? new Date(`${documentDate}T00:00:00.000Z`)
      : documentDate;
  const config = await readSequenceConfig(db, entityId, docType, statutory);
  const resetPeriod = config.resetPeriod;
  const prefix = config.prefix;
  const padWidth = config.padWidth;
  const period = computePeriod(resetPeriod, date);
  const now = new Date().toISOString();

  const [row] = await db
    .insert(schema.documentSequences)
    .values({
      id: createCuid(),
      entityId,
      docType,
      prefix,
      padWidth,
      resetPeriod,
      periodKey: period.key,
      nextNumber: 2,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.documentSequences.entityId,
        schema.documentSequences.docType,
        schema.documentSequences.periodKey,
      ],
      set: {
        nextNumber: sql`${schema.documentSequences.nextNumber} + 1`,
        updatedAt: now,
      },
    })
    .returning({
      nextNumber: schema.documentSequences.nextNumber,
      prefix: schema.documentSequences.prefix,
      padWidth: schema.documentSequences.padWidth,
    });

  const seq = (row?.nextNumber ?? 2) - 1;
  if (resetPeriod === "monthly" && seq > MONTHLY_SEQ_MAX) {
    throw new BadRequestException(
      `Monthly sequence for ${docType} ${period.key} is full (${MONTHLY_SEQ_MAX}).`,
      [
        {
          message: `Cannot issue more than ${MONTHLY_SEQ_MAX} ${docType} documents in ${period.key}`,
          messageTh: `ออกเอกสาร ${docType} ได้ไม่เกิน ${MONTHLY_SEQ_MAX} ฉบับในเดือน ${period.key}`,
        },
      ],
    );
  }
  return formatDocNumber(row?.prefix ?? prefix, seq, row?.padWidth ?? padWidth, period);
}

export async function allocateDraftNumber(
  db: DbLike,
  entityId: string,
  kind: "je" | "invoice",
): Promise<string> {
  return allocateDocumentNumber(
    db,
    entityId,
    kind === "je" ? "je-draft" : "invoice-draft",
  );
}
