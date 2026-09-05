import { eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function getSettings(db: Db) {
  const [row] = await db
    .select()
    .from(schema.crmSettings)
    .where(eq(schema.crmSettings.singleton, true))
    .limit(1);
  if (row) return row;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.crmSettings).values({
    id,
    singleton: true,
    notifyEmails: [],
    notifyOnCreate: true,
    notifyOwnerOnCreate: true,
    notifyOwnerOnStageChange: true,
    updatedAt: now,
  });
  const [created] = await db
    .select()
    .from(schema.crmSettings)
    .where(eq(schema.crmSettings.id, id))
    .limit(1);
  return created!;
}

export async function upsertSettings(
  db: Db,
  data: {
    notifyEmails: string[];
    notifyOnCreate: boolean;
    notifyOwnerOnCreate: boolean;
    notifyOwnerOnStageChange: boolean;
  },
  updatedById: string,
) {
  const existing = await getSettings(db);
  const now = new Date().toISOString();

  if (existing) {
    await db
      .update(schema.crmSettings)
      .set({ ...data, updatedBy: updatedById, updatedAt: now })
      .where(eq(schema.crmSettings.id, existing.id));
    const [row] = await db
      .select()
      .from(schema.crmSettings)
      .where(eq(schema.crmSettings.id, existing.id))
      .limit(1);
    return row!;
  }

  const id = crypto.randomUUID();
  await db.insert(schema.crmSettings).values({
    id,
    singleton: true,
    ...data,
    updatedBy: updatedById,
    updatedAt: now,
  });
  const [row] = await db.select().from(schema.crmSettings).where(eq(schema.crmSettings.id, id)).limit(1);
  return row!;
}
