import { eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function getSetting(db: Db, key: string) {
  const [row] = await db
    .select({ value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function upsertSetting(db: Db, key: string, value: unknown) {
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ key: schema.systemSettings.key })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key))
    .limit(1);
  if (existing) {
    await db.update(schema.systemSettings).set({ value, updatedAt: now }).where(eq(schema.systemSettings.key, key));
  } else {
    await db.insert(schema.systemSettings).values({ key, value, updatedAt: now });
  }
}
