import { and, count, desc, eq, ilike } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function findMany(
  db: Db,
  filters: { search?: string; status?: string },
  page: number,
  limit: number,
) {
  const conditions = [];
  if (filters.status) conditions.push(eq(schema.marketingCampaigns.status, filters.status));
  if (filters.search) conditions.push(ilike(schema.marketingCampaigns.title, `%${filters.search}%`));
  const where = conditions.length ? and(...conditions) : undefined;
  const [data, countRows] = await Promise.all([
    db
      .select({
        id: schema.marketingCampaigns.id,
        title: schema.marketingCampaigns.title,
        campaignDate: schema.marketingCampaigns.campaignDate,
        hours: schema.marketingCampaigns.hours,
        leversPulled: schema.marketingCampaigns.leversPulled,
        copyDesign: schema.marketingCampaigns.copyDesign,
        predictionFileUrl: schema.marketingCampaigns.predictionFileUrl,
        predictionFileName: schema.marketingCampaigns.predictionFileName,
        status: schema.marketingCampaigns.status,
        sortOrder: schema.marketingCampaigns.sortOrder,
        addedBy: schema.marketingCampaigns.addedBy,
        createdAt: schema.marketingCampaigns.createdAt,
        updatedAt: schema.marketingCampaigns.updatedAt,
        creatorId: schema.users.id,
        creatorName: schema.users.name,
        creatorEmail: schema.users.email,
      })
      .from(schema.marketingCampaigns)
      .leftJoin(schema.users, eq(schema.users.id, schema.marketingCampaigns.addedBy))
      .where(where)
      .orderBy(desc(schema.marketingCampaigns.campaignDate), desc(schema.marketingCampaigns.createdAt))
      .offset((page - 1) * limit)
      .limit(limit),
    db.select({ total: count() }).from(schema.marketingCampaigns).where(where),
  ]);
  return {
    data: data.map((r) => ({
      id: r.id,
      title: r.title,
      campaignDate: r.campaignDate,
      hours: r.hours,
      leversPulled: r.leversPulled,
      copyDesign: r.copyDesign,
      predictionFileUrl: r.predictionFileUrl,
      predictionFileName: r.predictionFileName,
      status: r.status,
      sortOrder: r.sortOrder,
      addedBy: r.addedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      creator: r.creatorId ? { id: r.creatorId, name: r.creatorName ?? "", email: r.creatorEmail ?? "" } : null,
    })),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findById(db: Db, id: string) {
  const [r] = await db
    .select({
      id: schema.marketingCampaigns.id,
      title: schema.marketingCampaigns.title,
      campaignDate: schema.marketingCampaigns.campaignDate,
      hours: schema.marketingCampaigns.hours,
      leversPulled: schema.marketingCampaigns.leversPulled,
      copyDesign: schema.marketingCampaigns.copyDesign,
      predictionFileUrl: schema.marketingCampaigns.predictionFileUrl,
      predictionFileName: schema.marketingCampaigns.predictionFileName,
      status: schema.marketingCampaigns.status,
      sortOrder: schema.marketingCampaigns.sortOrder,
      addedBy: schema.marketingCampaigns.addedBy,
      createdAt: schema.marketingCampaigns.createdAt,
      updatedAt: schema.marketingCampaigns.updatedAt,
      creatorId: schema.users.id,
      creatorName: schema.users.name,
      creatorEmail: schema.users.email,
    })
    .from(schema.marketingCampaigns)
    .leftJoin(schema.users, eq(schema.users.id, schema.marketingCampaigns.addedBy))
    .where(eq(schema.marketingCampaigns.id, id))
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    campaignDate: r.campaignDate,
    hours: r.hours,
    leversPulled: r.leversPulled,
    copyDesign: r.copyDesign,
    predictionFileUrl: r.predictionFileUrl,
    predictionFileName: r.predictionFileName,
    status: r.status,
    sortOrder: r.sortOrder,
    addedBy: r.addedBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    creator: r.creatorId ? { id: r.creatorId, name: r.creatorName ?? "", email: r.creatorEmail ?? "" } : null,
  };
}

export async function create(db: Db, data: {
  title: string;
  campaignDate: string;
  hours?: number | null;
  leversPulled?: string | null;
  copyDesign?: string | null;
  predictionFileUrl?: string | null;
  predictionFileName?: string | null;
  status?: string;
  addedBy: string;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.marketingCampaigns).values({
    id,
    title: data.title,
    campaignDate: data.campaignDate,
    hours: data.hours ?? null,
    leversPulled: data.leversPulled ?? null,
    copyDesign: data.copyDesign ?? null,
    predictionFileUrl: data.predictionFileUrl ?? null,
    predictionFileName: data.predictionFileName ?? null,
    status: data.status ?? "planned",
    addedBy: data.addedBy,
    createdAt: now,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(db: Db, id: string, data: Partial<{
  title: string;
  campaignDate: string;
  hours: number | null;
  leversPulled: string | null;
  copyDesign: string | null;
  predictionFileUrl: string | null;
  predictionFileName: string | null;
  status: string;
}>) {
  const now = new Date().toISOString();
  await db.update(schema.marketingCampaigns).set({ ...data, updatedAt: now }).where(eq(schema.marketingCampaigns.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.marketingCampaigns).where(eq(schema.marketingCampaigns.id, id));
}
