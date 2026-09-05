import type { Db } from "@nexora/db";
import { getSetting, upsertSetting } from "../lib/system-settings.js";

export const RECAP_TARGETS_KEY = "marketing.recap.targets";
export const RECAP_NOTES_KEY_PREFIX = "marketing.recap.notes.";

export interface RecapTarget {
  partnerId: string;
  targetDau: number | null;
  addressableMau: number | null;
  excluded: boolean;
}

export interface RecapNotes {
  yesterday: string[];
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

export function normalizeTargets(value: unknown): RecapTarget[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const v = raw as Record<string, unknown>;
    if (typeof v.partnerId !== "string" || !v.partnerId) return [];
    return [{
      partnerId: v.partnerId,
      targetDau: numberOrNull(v.targetDau),
      addressableMau: numberOrNull(v.addressableMau),
      excluded: v.excluded === true,
    }];
  });
}

export function normalizeNotes(value: unknown): RecapNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_NOTES };
  const v = value as Record<string, unknown>;
  return { yesterday: strings(v.yesterday), today: strings(v.today) };
}

export async function getTargets(db: Db): Promise<RecapTarget[]> {
  return normalizeTargets(await getSetting(db, RECAP_TARGETS_KEY));
}

export async function setTargets(db: Db, input: unknown): Promise<RecapTarget[]> {
  const targets = normalizeTargets(input);
  await upsertSetting(
    db,
    RECAP_TARGETS_KEY,
    targets.map((t) => ({
      partnerId: t.partnerId,
      targetDau: t.targetDau,
      addressableMau: t.addressableMau,
      excluded: t.excluded,
    })),
  );
  return targets;
}

export async function getNotes(db: Db, date: string): Promise<RecapNotes> {
  return normalizeNotes(await getSetting(db, RECAP_NOTES_KEY_PREFIX + date));
}

export async function setNotes(db: Db, date: string, input: unknown): Promise<RecapNotes> {
  const notes = normalizeNotes(input);
  await upsertSetting(db, RECAP_NOTES_KEY_PREFIX + date, {
    yesterday: notes.yesterday,
    today: notes.today,
  });
  return notes;
}
