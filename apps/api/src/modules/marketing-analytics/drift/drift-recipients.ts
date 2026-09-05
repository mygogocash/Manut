// Admin-editable recipients for the DAU/MAU drift alert, plus the last-seen
// fingerprint that debounces it. Both live in `SystemSetting` rather than a new
// table — same shape as the CRM reminder recipient lists.
import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

export const DRIFT_RECIPIENTS_KEY = "marketing-analytics.drift_recipients";
export const DRIFT_STATE_KEY = "marketing-analytics.drift_last";

/** Lowercase + trim + dedupe, dropping blanks and non-strings. */
function normalize(value: unknown): string[] {
  const v = (value ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(v.recipients)
    ? v.recipients.filter((x): x is string => typeof x === "string")
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of raw) {
    const clean = e.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

export async function getDriftRecipients(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: DRIFT_RECIPIENTS_KEY },
  });
  return normalize(row?.value);
}

export async function setDriftRecipients(
  recipients: string[],
): Promise<string[]> {
  const clean = normalize({ recipients });
  await prisma.systemSetting.upsert({
    where: { key: DRIFT_RECIPIENTS_KEY },
    // Inline literal: a typed variable trips Prisma's InputJsonValue.
    update: { value: { recipients: clean } },
    create: { key: DRIFT_RECIPIENTS_KEY, value: { recipients: clean } },
  });
  return clean;
}

export interface DriftState {
  fingerprint: string | null;
  notifiedAt: string | null;
}

export async function getDriftState(): Promise<DriftState> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: DRIFT_STATE_KEY },
  });
  const v = (row?.value ?? {}) as Record<string, unknown>;
  return {
    fingerprint: typeof v.fingerprint === "string" ? v.fingerprint : null,
    notifiedAt: typeof v.notifiedAt === "string" ? v.notifiedAt : null,
  };
}

export async function setDriftState(state: DriftState): Promise<void> {
  const value: Prisma.InputJsonObject = {
    fingerprint: state.fingerprint ?? "",
    notifiedAt: state.notifiedAt ?? "",
  };
  await prisma.systemSetting.upsert({
    where: { key: DRIFT_STATE_KEY },
    update: { value },
    create: { key: DRIFT_STATE_KEY, value },
  });
}
