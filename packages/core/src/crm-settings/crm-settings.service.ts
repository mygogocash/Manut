import type { UpdateCrmSettingsInput } from "@nexora/contracts/modules/crm-settings/crm-settings.validation";
import type { Db } from "@nexora/db";
import * as repo from "./crm-settings.repository";

function toPayload(row: Awaited<ReturnType<typeof repo.getSettings>>) {
  return {
    notifyEmails: row.notifyEmails ?? [],
    notifyOnCreate: row.notifyOnCreate,
    notifyOwnerOnCreate: row.notifyOwnerOnCreate,
    notifyOwnerOnStageChange: row.notifyOwnerOnStageChange,
    updatedAt: row.updatedAt,
  };
}

export async function getSettings(db: Db) {
  const row = await repo.getSettings(db);
  return { data: toPayload(row) };
}

export async function updateSettings(db: Db, input: UpdateCrmSettingsInput, actorId: string) {
  const dedupedEmails = Array.from(new Set(input.notifyEmails));
  const row = await repo.upsertSettings(
    db,
    {
      notifyEmails: dedupedEmails,
      notifyOnCreate: input.notifyOnCreate,
      notifyOwnerOnCreate: input.notifyOwnerOnCreate,
      notifyOwnerOnStageChange: input.notifyOwnerOnStageChange,
    },
    actorId,
  );
  return { data: toPayload(row) };
}
