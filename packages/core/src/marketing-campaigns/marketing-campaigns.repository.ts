import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@nexora/contracts/modules/marketing-campaigns/marketing-campaigns.validation";

export async function listLevers(db: Db, activeOnly: boolean) {
  const where = activeOnly ? eq(schema.mktLevers.isActive, true) : undefined;
  return db
    .select()
    .from(schema.mktLevers)
    .where(where)
    .orderBy(asc(schema.mktLevers.sortOrder), asc(schema.mktLevers.name));
}

export async function listCampaigns(db: Db, page: number, limit: number) {
  const where = isNull(schema.mktCampaigns.archivedAt);
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: schema.mktCampaigns.id,
        name: schema.mktCampaigns.name,
        campaignDate: schema.mktCampaigns.campaignDate,
        hours: schema.mktCampaigns.hours,
        status: schema.mktCampaigns.status,
        country: schema.mktCampaigns.country,
        partnerId: schema.mktCampaigns.partnerId,
        product: schema.mktCampaigns.product,
        channel: schema.mktCampaigns.channel,
        campaignType: schema.mktCampaigns.campaignType,
        budget: schema.mktCampaigns.budget,
        currency: schema.mktCampaigns.currency,
        expectedReach: schema.mktCampaigns.expectedReach,
        actualReach: schema.mktCampaigns.actualReach,
        archivedAt: schema.mktCampaigns.archivedAt,
        createdAt: schema.mktCampaigns.createdAt,
        ownerId: schema.users.id,
        ownerName: schema.users.name,
      })
      .from(schema.mktCampaigns)
      .leftJoin(schema.users, eq(schema.users.id, schema.mktCampaigns.ownerId))
      .where(where)
      .orderBy(desc(schema.mktCampaigns.campaignDate))
      .offset((page - 1) * limit)
      .limit(limit),
    db.select({ total: count() }).from(schema.mktCampaigns).where(where),
  ]);
  return { data: rows, total: Number(countRows[0]?.total ?? 0) };
}

export async function findCampaignById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.mktCampaigns)
    .where(and(eq(schema.mktCampaigns.id, id), isNull(schema.mktCampaigns.archivedAt)))
    .limit(1);
  return row ?? null;
}

export async function createCampaign(db: Db, input: CreateCampaignInput, actorId: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { leverIds: _leverIds, ...fields } = input;
  await db.insert(schema.mktCampaigns).values({
    id,
    name: fields.name,
    campaignDate: fields.campaignDate,
    hours: fields.hours ?? null,
    ownerId: fields.ownerId ?? actorId,
    status: fields.status ?? "planned",
    country: fields.country ?? null,
    partnerId: fields.partnerId ?? null,
    product: fields.product ?? null,
    channel: fields.channel ?? null,
    campaignType: fields.campaignType ?? null,
    objective: fields.objective ?? null,
    targetAudience: fields.targetAudience ?? null,
    leversSequence: fields.leversSequence ?? null,
    copyText: fields.copyText ?? null,
    expectedReach: fields.expectedReach ?? null,
    actualReach: fields.actualReach ?? null,
    budget: fields.budget == null ? null : String(fields.budget),
    currency: fields.currency ?? "USD",
    notes: fields.notes ?? null,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
  return findCampaignById(db, id);
}

export async function updateCampaign(db: Db, id: string, input: UpdateCampaignInput) {
  const { leverIds: _leverIds, ...fields } = input;
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    patch[k] = k === "budget" && v !== null ? String(v) : v;
  }
  await db.update(schema.mktCampaigns).set(patch).where(eq(schema.mktCampaigns.id, id));
  return findCampaignById(db, id);
}

export async function archiveCampaign(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.mktCampaigns)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(schema.mktCampaigns.id, id));
}
