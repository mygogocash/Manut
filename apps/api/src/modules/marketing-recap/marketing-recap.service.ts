import { prisma } from "@/infrastructure/database/prisma";

/**
 * Daily Recap state: the two things the recap needs that cannot be computed
 * from the analytics API.
 *
 * Everything else on the recap — DAU for the day, MAU so far, day-on-day,
 * same-day-last-week and same-day-last-month — is derived from the dashboard
 * payload the page already holds. Only these two are typed by a human, so
 * only these two are stored.
 *
 * Both follow the global-config-block pattern (payroll's payslip.company):
 * SystemSetting rows, no migration, code fallback when absent.
 */

/** Per-telco targets. One row for the whole org. */
export const RECAP_TARGETS_KEY = "marketing.recap.targets";
/** Per-day briefing notes. One row per calendar day. */
export const RECAP_NOTES_KEY_PREFIX = "marketing.recap.notes.";

export interface RecapTarget {
  /** Telco/partner id this target belongs to. */
  partnerId: string;
  /** Business DAU target. Null when none has been set. */
  targetDau: number | null;
  /**
   * Addressable MAU for this telco. Deliberately stored rather than derived:
   * the deck's figure (Telkomsel 10.8M) does not match the host MAU the
   * analytics API reports, so computing it would quietly disagree with the
   * numbers management already reviews.
   */
  addressableMau: number | null;
  /** Excluded telcos render "(excluded)" instead of a figure. */
  excluded: boolean;
}

export interface RecapNotes {
  /** "Yesterday's Developments" bullets. */
  yesterday: string[];
  /** "Today" bullets. */
  today: string[];
}

const EMPTY_NOTES: RecapNotes = { yesterday: [], today: [] };

function strings(x: unknown): string[] {
  return Array.isArray(x)
    ? x.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
}

function numberOrNull(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/**
 * Type-guard the stored JSON. An admin wrote it through the API and a future
 * change may outgrow it, so a malformed row degrades to "nothing configured"
 * rather than throwing on read and taking the recap down with it.
 */
export function normalizeTargets(value: unknown): RecapTarget[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const v = raw as Record<string, unknown>;
    if (typeof v.partnerId !== "string" || !v.partnerId) return [];
    return [
      {
        partnerId: v.partnerId,
        targetDau: numberOrNull(v.targetDau),
        addressableMau: numberOrNull(v.addressableMau),
        excluded: v.excluded === true,
      },
    ];
  });
}

export function normalizeNotes(value: unknown): RecapNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_NOTES };
  }
  const v = value as Record<string, unknown>;
  return { yesterday: strings(v.yesterday), today: strings(v.today) };
}

export const marketingRecapService = {
  async getTargets(): Promise<RecapTarget[]> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: RECAP_TARGETS_KEY },
    });
    return normalizeTargets(row?.value);
  },

  async setTargets(input: unknown): Promise<RecapTarget[]> {
    const targets = normalizeTargets(input);
    await prisma.systemSetting.upsert({
      where: { key: RECAP_TARGETS_KEY },
      // Mapped inline: passing the typed RecapTarget[] straight through
      // trips Prisma's InputJsonValue, the same trap the payslip-company
      // note in CLAUDE.md describes for objects.
      create: {
        key: RECAP_TARGETS_KEY,
        value: targets.map((t) => ({
          partnerId: t.partnerId,
          targetDau: t.targetDau,
          addressableMau: t.addressableMau,
          excluded: t.excluded,
        })),
      },
      update: {
        value: targets.map((t) => ({
          partnerId: t.partnerId,
          targetDau: t.targetDau,
          addressableMau: t.addressableMau,
          excluded: t.excluded,
        })),
      },
    });
    return targets;
  },

  async getNotes(date: string): Promise<RecapNotes> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: RECAP_NOTES_KEY_PREFIX + date },
    });
    return normalizeNotes(row?.value);
  },

  async setNotes(date: string, input: unknown): Promise<RecapNotes> {
    const notes = normalizeNotes(input);
    await prisma.systemSetting.upsert({
      where: { key: RECAP_NOTES_KEY_PREFIX + date },
      create: {
        key: RECAP_NOTES_KEY_PREFIX + date,
        value: { yesterday: notes.yesterday, today: notes.today },
      },
      update: { value: { yesterday: notes.yesterday, today: notes.today } },
    });
    return notes;
  },
};
