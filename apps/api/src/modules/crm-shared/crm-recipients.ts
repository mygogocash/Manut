import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import { CRM_MODULES, type CrmModule } from "@/modules/crm-shared/crm-modules";

// Admin-editable extra recipients for a CRM's deadline-reminder + update
// notification emails (on top of each record's owner + assignees). One
// SystemSetting row per module, keyed by CRM_MODULES[module].recipientKey.
// Empty list = owner/assignees only.

export interface CrmRecipients {
  recipients: string[];
}

// Normalize on read/write: lowercase + trim + dedupe, drop blanks/non-strings.
function normalize(value: unknown): CrmRecipients {
  const v = (value ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(v.recipients)
    ? v.recipients.filter((x): x is string => typeof x === "string")
    : [];
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const e of raw) {
    const clean = e.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      recipients.push(clean);
    }
  }
  return { recipients };
}

export async function getCrmReminderRecipients(
  module: CrmModule,
): Promise<CrmRecipients> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: CRM_MODULES[module].recipientKey },
  });
  return normalize(row?.value);
}

export async function setCrmReminderRecipients(
  module: CrmModule,
  input: { recipients?: string[] },
): Promise<CrmRecipients> {
  const clean = normalize(input);
  const value: Prisma.InputJsonObject = { recipients: clean.recipients };
  const key = CRM_MODULES[module].recipientKey;
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  return clean;
}
