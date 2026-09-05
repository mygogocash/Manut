import { desc, eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function listAlerts(db: Db) {
  return db.select().from(schema.validatorNodeAlerts).orderBy(desc(schema.validatorNodeAlerts.createdAt));
}
export async function listEnabledAlerts(db: Db) {
  return db.select().from(schema.validatorNodeAlerts).where(eq(schema.validatorNodeAlerts.enabled, true));
}
export async function getAlert(db: Db, id: string) {
  const [row] = await db.select().from(schema.validatorNodeAlerts).where(eq(schema.validatorNodeAlerts.id, id)).limit(1);
  return row ?? null;
}
export async function createAlert(db: Db, data: { name: string; nodeId: string | null; field: string; operator: string; threshold: number; email: string; enabled: boolean; cooldownMinutes: number; createdBy: string }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.validatorNodeAlerts).values({ id, name: data.name, nodeId: data.nodeId, field: data.field, operator: data.operator, threshold: String(data.threshold), email: data.email, enabled: data.enabled, cooldownMinutes: data.cooldownMinutes, createdBy: data.createdBy, createdAt: now, updatedAt: now });
  return getAlert(db, id);
}
export async function updateAlert(db: Db, id: string, data: Partial<{ name: string; nodeId: string | null; field: string; operator: string; threshold: number; email: string; enabled: boolean; cooldownMinutes: number }>) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const k in data) {
    if ((data as Record<string, unknown>)[k] !== undefined) {
      patch[k] = k === "threshold" ? String((data as Record<string, unknown>)[k]) : (data as Record<string, unknown>)[k];
    }
  }
  await db.update(schema.validatorNodeAlerts).set(patch).where(eq(schema.validatorNodeAlerts.id, id));
  return getAlert(db, id);
}
export async function deleteAlert(db: Db, id: string) {
  await db.delete(schema.validatorNodeAlerts).where(eq(schema.validatorNodeAlerts.id, id));
}
export async function markTriggered(db: Db, id: string, when: Date) {
  await db.update(schema.validatorNodeAlerts).set({ lastTriggeredAt: when.toISOString(), updatedAt: new Date().toISOString() }).where(eq(schema.validatorNodeAlerts.id, id));
}
